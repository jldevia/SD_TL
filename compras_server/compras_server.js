var Compra = require('./compra');
var _ = require('underscore');
var amqp = require('amqplib');
const Stepper = require('../stepperEngine');
const EventEmitter = require('events').EventEmitter;
const util = require('../util');
const utilDB = require('../utilDB');
var snapshot = require('../snapshot');

'use strict';

class ServidorCompras extends EventEmitter{
	constructor(modo){
		super();
		this.urlDB = 'mongodb://localhost:27017/compras_db';
		
		//Snapshot
		this.snapshot = snapshot();
		this.snapshot.origen_corte = 'compras';
		this.cantidad_fin_corte = 5;

		this.modo = modo || 'AUTOMATICO';
		this.stepper = new Stepper(this.modo, 1);

		//DB in memory: Infracciones en proceso o procesadas
		this.compras = new Array();

		this.on('nuevaCompra', (msg) => this.generarNuevaCompra(msg));
		this.on('corte', (data) => this.procesarCorte(data));

		//socket de comunicacion con el monitor
		this.socket = require('socket.io-client')('http://localhost:17852', {
			query : {
				origen : 'compras'
			},
			transports : ['websocket']
		});
		
		this.socket.on('getEstadoCompra', (data)=> this.informarEstado(data));
		this.socket.on('getCompras', (data) => this.informarComprasEnProceso(data));
		this.socket.on('avanzarCompra', (data) => this.avanzarProcesamientoCompra(data));
		this.socket.on('finalizarEjecucion', (data) => this.bajarServidor(data));
		this.socket.on('corte', () => this.iniciarCorte());
		
		//Cada un minuto se guarda el estado de las compras
		// setInterval( function(url, registros){
		// 	utilDB.guardarEstado(url, registros);
		// }, 60000, this.urlDB, this.compras);

		if (this.modo === 'AUTOMATICO'){
			setInterval(function(obj){
				obj.iniciarCorte();
			}, 15000, this);
		}
	}

	//Metodos de tratamiento de eventos del Monitor
	//**************************************************
	informarEstado(data){
		var obj = this.getCompraByNum(data.num_compra);
		var resp;
		if (!obj){
			resp = {
				num_compra : 'Compra Inexistente',
				estado : '-------------------',
				prox_eventos : '-------------------',
				data : '-------------------',
				reloj : '-------------------'
			};
		}else{
			resp = {
				num_compra : obj.num_compra? obj.num_compra: 'Compra Inexistente',
				estado : obj.estado.nombre? obj.estado.nombre : 'Sin Estado',
				prox_eventos : obj.eventosPendientes? util.getProximosEventos(obj.eventosPendientes) : 'Sin Eventos Pendientes',
				data : obj.data,
				reloj : this.stepper.clock
			};
		}
		
		this.socket.emit('estadoCompra', resp);
	}
	
	informarComprasEnProceso(data){
		var listado = new Array();
		_.each(this.compras, (item) =>{
			listado.push(item.num_compra);
		});
		this.socket.emit('listadoCompras', { listado_compras: listado});
	}
	
	avanzarProcesamientoCompra(data){
		var obj = this.getCompraByNum(data.num_compra);
		this.stepper.emit('pasoManual', obj, data.arg);
	}
	
	bajarServidor(data){
		process.exit(0);
	}

	//Snapshot
	iniciarCorte(){
		console.log('Iniciando corte en compras ...');
		
		this.snapshot.setEstadoProceso(this.compras);
		this.snapshot.en_corte = true;
		this.snapshot.estado_clock = this.stepper.clock.slice(0);
		//console.log('snapshot iniciado: ' + JSON.stringify(this.snapshot));
		var topico = '.envios.infracciones.pagos.publicaciones.web.';
		var msg = {
			evento : 'corte',
		};
		this.publicarMensaje(topico, msg);

		//Se encolan los mensajes pendientes de procesamiento
		// _.forEach(this.compras, (item) =>{
		// 	_.forEach(item.eventosPendientes, (element) => {
		// 		console.log('Mensaje encolado: ' + JSON.stringify(element));
		// 		this.snapshot.encolarMensaje(JSON.parse(JSON.stringify(element)));
		// 	});
		// });
	}
	//**************************************************

	generarNuevaCompra(msg){
		var newCompra = new Compra(this, msg.data);
		
		this.compras.push(newCompra);

		this.stepper.emit('paso', newCompra, msg.evento, msg.data);
		
		this.prox_num_compra++;

		
		console.log('----------------------------------');
		console.log('Nueva compra:\n' + JSON.stringify(newCompra.data));
		console.log('----------------------------------');
		var msg1 = 'Nueva compra:\\n' + JSON.stringify(newCompra.data);
		this.logMonitor(msg1);
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
			origen : 'compras',
			estado_proceso : this.snapshot.estado_proceso,
			estado_channels : this.snapshot.getAllChannels(),
			clock : this.snapshot.estado_clock
		};

		this.socket.emit('logSnapshot', msg);
	}

	eliminarCompra(num_compra){
		_.each(this.compras, (element, index) => {
			if ( element.num_compra == num_compra ){
				this.compras.splice(index, 1);
			}
		});
	}

	getCompraByNum(num_compra){
		return _.find(this.compras, (element) =>{
			return (element.num_compra == num_compra);
		});
	}

	logMonitor(msg){
		
		var data = {
			origen : 'compras',
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
						mensaje.origen = 'compras';
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
						console.error('[Compras_server]: Error Creando canal: ' + err);
						obj.logMonitor('[Compras_server]: Error Creando canal: ' + err);
					});
			})
			.catch( function(err){
				console.error('[Compras_server]: Error conectando a servidor de mensajeria: ' + err);
				obj.logMonitor('[Compras_server]: Error conectando a servidor de mensajeria: ' + err);
			});
	}

}//fin de la clase

var server = new ServidorCompras(process.argv[2]);

console.log('[Compras_server] en ejecución en modo ' + server.modo);
server.logMonitor('[Compras_server] en ejecución en modo ' + server.modo);
console.log('Esperando mensajes...');
server.logMonitor('Esperando mensajes...');

amqp.connect('amqp://localhost')
	.then(function(con){
		con.createChannel()
			.then(function(chn){
				var queue = 'compras_server';
				chn.assertQueue(queue, {durable : true});
				chn.consume(queue, (msg) => {
					var mensaje = JSON.parse(msg.content.toString());

					console.log('------------------------------------------');
					console.log('Mensaje recibido: %s', JSON.stringify(mensaje));
					console.log('------------------------------------------');
					server.logMonitor('Mensaje recibido:\\n' + JSON.stringify(mensaje));
					
					if (mensaje.evento === 'nuevaCompra') {
						server.emit('nuevaCompra', mensaje);
					}else if (mensaje.evento === 'corte'){
						//Snapshot
						server.emit('corte', mensaje);
					}else{
						var compra = server.getCompraByNum(mensaje.data.num_compra);
						if (compra){
							server.stepper.emit('paso', compra, mensaje.evento, mensaje.data);
							//Se actualiza reloj vectorial
							util.actualizarReloj(server.stepper.clock, mensaje.clock);
							//Snapshot
							if (server.snapshot.en_corte){
								server.snapshot.encolarMensaje(JSON.parse(JSON.stringify(mensaje)));
							}
						}
						
					}
					chn.ack(msg);	
				}, {noAck: false})
					.catch( function(err){
						console.error('[Compras_server]: Error al consumir mensajes: ' + err);
						server.logMonitor('[Compras_server]: Error al consumir mensajes: ' + err);
					});	
			})
			.catch(function(err){
				console.error('[Compras_server]: Error createChannel: '+ err);
				server.logMonitor('[Compras_server]: Error createChannel: '+ err);
			});
	})
	.catch(function (err){
		console.error('[Compras_server]: Error connect: ' + err);
		server.logMonitor('[Compras_server]: Error connect: ' + err);
	});
