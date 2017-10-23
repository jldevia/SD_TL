var amqp = require  ('amqplib');
var _ = require('underscore');
const EventEmitter = require('events').EventEmitter;
const StepperEngine = require('../stepperEngine');
const Pago = require('./pago');
const util = require('../util');

'use strict';

//Clase que simula la ejecucion del servidor de "Pagos"
class ServidorPagos extends EventEmitter {
	constructor(modo){
		super();
		
		this.modo = modo || 'AUTOMATICO';
		this.prox_num_pago = 1;
		this.stepper = new StepperEngine(this.modo);

		//DB in memory: Pagos en proceso o procesadas
		this.pagos = new Array();

		//socket de comunicacion con el monitor
		this.socket = require('socket.io-client')('http://localhost:17852', {
			query : {
				origen : 'pagos'
			}
		});
		
		this.socket.on('getEstadoCompra', (data)=> this.informarEstado(data));
		this.socket.on('getCompras', (data) => this.informarComprasEnProceso(data));
		this.socket.on('avanzarCompra', (data) => this.avanzarProcesamientoCompra(data));
		this.socket.on('finalizarEjecucion', (data) => this.bajarServidor(data));

		//Se registran eventos del servidor
		this.on('nuevoPago', (msg) => this.nuevoPago(msg));

		//Se persiste estado del servidor cada 1 minuto
		setInterval(this.guardarEstado, 60000);
	}

	//Metodos de tratamiento de eventos del Monitor
	//**************************************************
	informarEstado(data){
		var obj = this.getPago(data.num_compra);
		var resp = {
			num_compra : obj? obj.data.num_compra : '---------',
			estado : obj? obj.estado.nombre : '---------',
			prox_eventos : obj? obj.eventosPendientes : '---------'	
		};

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
		this.stepper.emit('pasoManual', obj, data);
	}
	
	bajarServidor(data){
		process.exit(0);
	}
	//**************************************************/


	nuevoPago(msg){
		var newPago = new Pago(this, this.prox_num_pago, msg.data);

		this.pagos.push(newPago);

		this.stepper.emit('paso', newPago, msg.evento, msg.data);
		
		this.prox_num_pago++;
	}

	guardarEstado(){
		null;
	}

	getPago(num_compra){
		return _.find(this.pagos, function(item){
			return item.data.num_compra == num_compra;
		});
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
						chnl.publish(ex, topico, new Buffer(mensaje));
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
					}else{
						var obj = server.getPago(mensaje.data.num_compra);
						server.stepper.emit('paso', obj, mensaje.evento, mensaje.data);
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

