var amqp = require  ('amqplib');
var _ = require('underscore');
const EventEmitter = require('events').EventEmitter;
const StepperEngine = require('../stepperEngine');
const Pago = require('./pago');
const util = require('../util');
const utilDB = require('../utilDB');
var snapshot = require('../snapshot');

'use strict';

//Clase que simula la ejecucion del servidor de "Pagos"
class ServidorPagos extends EventEmitter {
	constructor(modo){
		super();
		this.urlDB = 'mongodb://localhost:27017/pagos_db';
		
		this.modo = modo || 'AUTOMATICO';
		this.prox_num_pago = 1;
		this.stepper = new StepperEngine(this.modo, 4);

		//Snapshot
		this.snapshot = snapshot();
		this.snapshot.origen_corte = 'pagos';
		this.cantidad_fin_corte = 5;


		//DB in memory: Pagos en proceso o procesadas
		this.pagos = new Array();

		//socket de comunicacion con el monitor
		this.socket = require('socket.io-client')('http://localhost:17852', {
			query : {
				origen : 'pagos'
			},
			transports : ['websocket']
		});
		
		this.socket.on('getEstadoCompra', (data)=> this.informarEstado(data));
		this.socket.on('getCompras', (data) => this.informarComprasEnProceso(data));
		this.socket.on('avanzarCompra', (data) => this.avanzarProcesamientoCompra(data));
		this.socket.on('finalizarEjecucion', (data) => this.bajarServidor(data));
		this.socket.on('corte', () => this.iniciarCorte());

		//Se registran eventos del servidor
		this.on('nuevoPago', (msg) => this.nuevoPago(msg));
		this.on('corte', (data) => this.procesarCorte(data));

		//Se persiste estado del servidor cada 1 minuto
		// setInterval( function(url, registros){
		// 	utilDB.guardarEstado(url, registros);
		// }, 60000, this.urlDB, this.pagos);
	}

	//Metodos de tratamiento de eventos del Monitor
	//**************************************************
	informarEstado(data){
		var obj = this.getPago(data.num_compra);
		var resp = new Object();
		if (!obj){
			resp.num_compra = 'Compra inexistente';
			resp.estado = '-------------------';
			resp.prox_eventos = '-------------------';
			resp.data = '-------------------';
			resp.reloj = '-------------------';
		}else{
			resp = {
				num_compra : obj.data.num_compra? obj.data.num_compra : 'Compra Inexistente',
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
		_.each(this.pagos, (item) =>{
			listado.push(item.num_compra);
		});
		this.socket('listadoCompras', { listado_compras: listado});
	}
	
	avanzarProcesamientoCompra(data){
		var obj = this.getPago(data.num_compra);
		this.stepper.emit('pasoManual', obj, data.arg);
	}
	
	bajarServidor(data){
		process.exit(0);
	}

	//Snapshot
	iniciarCorte(){
		console.log('Iniciando corte en pagos ...');
		
		this.snapshot.setEstadoProceso(this.pagos);
		this.snapshot.en_corte = true;
		this.snapshot.estado_clock = this.stepper.clock.slice(0);
		var topico = '.envios.infracciones.compras.publicaciones.web.';
		var msg = {
			evento : 'corte',
		};
		this.publicarMensaje(topico, msg);

		//Se encolan los mensajes pendientes de procesamiento
		// _.forEach(this.pagos, (item) =>{
		// 	_.forEach(item.eventosPendientes, (element) => {
		// 		this.snapshot.encolarMensaje(JSON.parse(JSON.stringify(element)));
		// 	});
		// });
	}
	//**************************************************/

	nuevoPago(msg){
		var newPago = new Pago(this, this.prox_num_pago, msg.data);

		this.pagos.push(newPago);

		this.stepper.emit('paso', newPago, msg.evento, msg.data);
		
		this.prox_num_pago++;
	}

	getPago(num_compra){
		return _.find(this.pagos, function(item){
			return item.data.num_compra == num_compra;
		});
	}

	//Snapshot
	procesarCorte(msg){
		if (!this.snapshot.en_corte){
			this.iniciarCorte();
			this.snapshot.origen_corte = msg.origen;
		}else{
			this.snapshot.guardarEstadoChannel(msg.origen);
		}
		this.snapshot.contador++;
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
			origen : 'pagos',
			estado_proceso : this.snapshot.estado_proceso,
			estado_channels : this.snapshot.getAllChannels(),
			clock : this.snapshot.estado_clock
		};

		this.socket.emit('logSnapshot', msg);
	}

	logMonitor(msg){
		var data = {
			origen : 'pagos_server',
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
						mensaje.origen = 'pagos';
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
						console.error('[Pagos_server]: Error Creando canal: ' + err);
						obj.logMonitor('[Pagos_server]: Error Creando canal: ' + err);
					});
			})
			.catch( function(err){
				console.error('[Pagos_server]: Error conectando a servidor de mensajeria: ' + err);
				obj.logMonitor('[Pagos_server]: Error conectando a servidor de mensajeria: ' + err);
			});
	}	
	
}

var server = new ServidorPagos(process.argv[2]);

console.log('[Pagos_server] en ejecución en modo ' + server.modo);
server.logMonitor('[Pagos_server] en ejecución en modo ' + server.modo);
console.log('Esperando mensajes...');
server.logMonitor('Esperando mensajes...');
amqp.connect('amqp://localhost')
	.then(function(con){
		con.createChannel()
			.then(function(chn){
				var queue = 'pagos_server';
				chn.assertQueue(queue, {durable : true});
				chn.consume(queue, (msg) => {
					var mensaje = JSON.parse(msg.content.toString());
					
					console.log('------------------------------------------');
					console.log('Mensaje recibido: %s', JSON.stringify(mensaje));
					console.log('------------------------------------------');
					server.logMonitor('Mensaje recibido:\\n', JSON.stringify(mensaje));					
					
					if ( mensaje.evento === 'autorizarPago' ) {
						server.emit('nuevoPago', mensaje);
					} else if (mensaje.evento == 'corte') {
						server.emit('corte', mensaje);
					}else{
						var obj = server.getPago(mensaje.data.num_compra);
						server.stepper.emit('paso', obj, mensaje.evento, mensaje.data);
						//Se actualiza reloj vectorial
						util.actualizarReloj(server.stepper.clock, mensaje.clock);
						//Snapshot
						if (server.snapshot.en_corte){
							server.snapshot.encolarMensaje(JSON.parse(JSON.stringify(mensaje)));
							
						}
					}
					chn.ack(msg);
				}, {noAck: false})
					.catch( function(err){
						console.error('[Pagos_server]: Error al consumir mensajes: ' + err);
						server.logMonitor('[Pagos_server]: Error al consumir mensajes: ' + err);
					});	
			})
			.catch(function(err){
				console.error('[Pagos_server]: Error createChannel: '+ err);
				server.logMonitor('[Pagos_server]: Error createChannel: '+ err);
			});
	})
	.catch(function (err){
		console.error('[Pagos_server]: Error connect: ' + err);
		server.logMonitor('[Pagos_server]: Error connect: ' + err);
	});

