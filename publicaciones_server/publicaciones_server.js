var amqp = require  ('amqplib');
var PublicationModel = require('./models/publication');
const EventEmitter = require('events').EventEmitter;
const _ = require('underscore');
const Stepper = require('../stepperEngine');
const Publicacion = require('./publicacion');
const util = require('../util');
const utilDB = require('../utilDB');
var snapshot = require('../snapshot'); 

'use strict';

class ServidorPublicaciones extends EventEmitter{
	constructor(modo){
		super();
		this.urlDB = 'mongodb://localhost:27017/publicaciones_db';

		this.modo = modo || 'AUTOMATICO';
		this.prox_num_req = 1;
		this.stepper = new Stepper(this.modo, 5);

		//Snapshot
		this.snapshot = snapshot();
		this.snapshot.origen_corte = 'publicaciones';
		this.cantidad_fin_corte = 5;
		

		//DB in memory: Solicitudes en proceso o procesadas
		this.solicitudes = new Array();

		//socket de comunicacion con el monitor
		this.socket = require('socket.io-client')('http://localhost:17852', {
			query : {
				origen : 'publicaciones'
			},
			transports : ['websocket']
		});

		this.socket.on('getEstadoCompra', (data)=> this.informarEstado(data));
		this.socket.on('getCompras', (data) => this.informarComprasEnProceso(data));
		this.socket.on('avanzarCompra', (data) => this.avanzarProcesamientoCompra(data));
		this.socket.on('finalizarEjecucion', (data) => this.bajarServidor(data));
		this.socket.on('corte', () => this.iniciarCorte());
		
		//Registro de eventos
		this.on('devolverPublicaciones', (data) => this.enviarPublicaciones(data));
		this.on('nuevaSolicitud', (msg) => this.nuevaSolicitud(msg));
		this.on('corte', (data) => this.procesarCorte(data));

		//Publication.runSeeder();

		//Se guarda el estado cada 1 minuto
		// setInterval(function(url, registros){
		// 	utilDB.guardarEstado(url, registros);
		// }, 60000, this.urlDB, this.solicitudes);
		
	}

	//Metodos de tratamiento de eventos del Monitor
	//**************************************************
	informarEstado(data){
		var obj = this.getSolicitud(data.num_compra);
		var resp = new Object();
		if (!obj){
			resp.num_compra = 'Compra inexistente';
			resp.estado = '-------------------';
			resp.prox_eventos = '-------------------';
			resp.data = '-------------------';
			resp.reloj = '-------------------';
		}else{
			resp.num_compra = obj.data.num_compra? obj.data.num_compra : 'Compra inexistente';
			resp.estado = obj.estado.nombre? obj.estado.nombre : 'Sin Estado';
			resp.prox_eventos = obj.eventosPendientes? util.getProximosEventos(obj.eventosPendientes) : 'Sin Eventos Pendientes';
			resp.data = obj.data;
			resp.reloj = this.stepper.clock;
		}

		this.socket.emit('estadoCompra', resp);
	}
	
	informarComprasEnProceso(data){
		var listado = new Array();
		_.each(this.solicitudes, (item) =>{
			listado.push(item.num_compra);
		});
		this.socket.emit('listadoCompras', { listado_compras: listado});
	}
	
	avanzarProcesamientoCompra(data){
		var obj = this.getSolicitud(data.num_compra);
		this.stepper.emit('pasoManual', obj, data.arg);
	}
	
	bajarServidor(data){
		process.exit(0);
	}

	//Snapshot
	iniciarCorte(){
		console.log('Iniciando corte en publicaciones ...');
		
		this.snapshot.setEstadoProceso(this.solicitudes);
		this.snapshot.en_corte = true;
		this.snapshot.estado_clock = this.stepper.clock.slice(0);
		var topico = '.envios.infracciones.pagos.compras.web.';
		var msg = {
			evento : 'corte',
		};
		this.publicarMensaje(topico, msg);

		//Se encolan los mensajes pendientes de procesamiento
		// _.forEach(this.solicitudes, (item) =>{
		// 	_.forEach(item.eventosPendientes, (element) => {
		// 		this.snapshot.encolarMensaje(JSON.parse(JSON.stringify(element)));
		// 	});
		// });
	}
	//**************************************************

	enviarPublicaciones(data){
		var topico = '.'+data.solicita+'.';
		var mensaje = new Object();
		mensaje.evento = 'publicacionesSolicitadas';
		PublicationModel.find(function(err, result){
			if(err){
				mensaje.data = { 
					estado : 'Error', 
					mensaje: '[Pubicaciones_Server]: Error al recuperar listado de publicaciones'
				};
			}else{
				mensaje. data = result.toJSON();
			}
		});

		this.publicarMensaje(topico, JSON.stringify(mensaje));

	}

	
	nuevaSolicitud(msg){
		var newSolicitud = new Publicacion(this, this.prox_num_req, msg.data);

		this.solicitudes.push(newSolicitud);

		this.stepper.emit('paso', newSolicitud, msg.evento, msg.data);
		
		this.prox_num_req++;
	}

	//Snapshot
	procesarCorte(msg){
		if (!this.snapshot.en_corte){
			this.iniciarCorte();
			this.snapshot.origen_corte = msg.origen;
		}else{
			this.snapshot.guardarEstadoChannel(msg.origen);
		}
		this.snapshot.contador = this.snapshot.contador + 1;
		//Se verifica fin de corte
		if (this.snapshot.contador == this.cantidad_fin_corte) {
			this.informarSnapshot();
			//Persistir estado del proceso y canales en la BD
			//utilDB.guardarEstado(this.urlDB, this.snapshot.estado_proceso);
			
			//reiniciar snapshot
			this.snapshot = snapshot();
		}
	}

	//Snapshot
	informarSnapshot(){
		var msg = {
			origen : 'publicaciones',
			estado_proceso : this.snapshot.estado_proceso,
			estado_channels : this.snapshot.getAllChannels(),
			clock : this.snapshot.estado_clock
		};

		this.socket.emit('logSnapshot', msg);
	}
	
	getSolicitud(num_compra){
		return _.find(this.solicitudes, function(item){
			return item.data.num_compra == num_compra;
		});
	}

	logMonitor(msg){
		var data = {
			origen : 'publicaciones_server',
			mensaje: util.formatearMsg(msg)
		};
		this.socket.emit('logMensaje', data);
	}

	publicarMensaje(topico, mensaje){
		var obj = this;
		amqp.connect('amqp://localhost')
			.then(function(con){
				con.createChannel()
					.then(function(chnl){
						var ex = 'compras.topic';
						chnl.assertExchange(ex, 'topic', {durable: true});
						mensaje.clock = obj.stepper.clock;
						mensaje.origen = 'publicaciones';
						chnl.publish(ex, topico, new Buffer(JSON.stringify(mensaje)));
						console.log('------------------------------------------');
						console.log('Mensaje publicado:');
						console.log('Topico: %s\nMensaje: ', topico, mensaje);
						console.log('------------------------------------------');
						
						var msg = 'Mensaje publicado:\\n';
						msg = msg + 'Topico: ' + topico + '\\n';
						msg = msg + 'Mensaje: ' + mensaje;
						obj.logMonitor(msg);
					})
					.catch(function(err){
						console.error('[Publicaciones_server]: Error Creando canal: ' + err);
						obj.logMonitor('[Publicaciones_server]: Error Creando canal: ' + err);
					});
			})
			.catch( function(err){
				console.error('[Publicaciones_server]: Error conectando a servidor de mensajeria: ' + err);
				obj.logMonitor('[Publicaciones_server]: Error conectando a servidor de mensajeria: ' + err);
			});
	}
}

var server = new ServidorPublicaciones(process.argv[2]);

console.log('[Publicaciones_server] en ejecución en modo ' + server.modo);
server.logMonitor('[Publicaciones_server] en ejecución en modo ' + server.modo);
console.log('Esperando mensajes...');
server.logMonitor('Esperando mensajes...');

amqp.connect('amqp://localhost')
	.then(function(con){
		con.createChannel()
			.then(function(chn){
				var queue = 'publicaciones_server';
				chn.assertQueue(queue, {durable : true});
				chn.consume(queue, (msg) => {
					var mensaje = JSON.parse(msg.content.toString());
					
					console.log('------------------------------------------');
					console.log('Mensaje recibido: %s', JSON.stringify(mensaje));
					console.log('------------------------------------------');
					server.logMonitor('Mensaje recibido:\\n' + JSON.stringify(mensaje));
					
					if (mensaje.evento === 'compraGenerada'){
						server.emit('nuevaSolicitud', mensaje);
					}else if (mensaje.evento == 'corte') {
						//Snapshot
						server.emit('corte', mensaje);
					}else{
						var obj = server.getSolicitud(mensaje.data.num_compra);
						if (obj){
							server.stepper.emit('paso', obj, mensaje.evento, mensaje.data);
							//Se actualiza reloj vectorial
							util.actualizarReloj(server.stepper.clock, mensaje.clock);
							//Snapshot
							if (server.snapshot.en_corte){
								server.snapshot.encolarMensaje(JSON.parse(JSON.stringify(mensaje)));
							}
						}else{
							console.log('------------------------------------------');
							console.log('No existe una solicitud asociada al N° de compra: %d', mensaje.data.num_compra);
							console.log('------------------------------------------');
							server.logMonitor('No existe una solicitud asociada al N° de compra:' + mensaje.data.num_compra);		
						}
					}
					
					chn.ack(msg);
				}, {noAck: false})
					.catch( function(err){
						console.error('[Publicaciones_server]: Error al consumir mensajes: ' + err);
						server.logMonitor('[Publicaciones_server]: Error al consumir mensajes: ' + err);
					});	
			})
			.catch(function(err){
				console.error('[Publicaciones_server]: Error createChannel: '+ err);
				server.logMonitor('[Publicaciones_server]: Error createChannel: '+ err);
			});
	})
	.catch(function (err){
		console.error('[Publicaciones_server]: Error connect: ' + err);
		server.logMonitor('[Publicaciones_server]: Error connect: ' + err);
	});




