var amqp = require  ('amqplib');
var _ = require('underscore');
const Infraccion = require('./infraccion');
const Stepper = require('../stepperEngine');
const util = require('../util');

const EventEmitter = require('events').EventEmitter;

//Clase que simula la ejecucion del servidor de "Infracciones"
class ServidorInfracciones extends EventEmitter{
	constructor (modo) {
		super();

		this.modo = modo || 'AUTOMATICO';
		this.prox_num_infraccion = 1;
		this.stepper = new Stepper(this.modo);

		//DB in memory: Infracciones en proceso o procesadas
		this.infracciones = new Array();

		this.on('nuevaInfraccion', (msg) => this.nuevaInfraccion(msg));
		
		//webSocket de comunicacion con el monitor
		this.socket = require('socket.io-client')('http://localhost:17852', {
			query : {
				origen : 'infracciones'
			}
		});
		
		this.socket.on('getEstadoCompra', (data)=> this.informarEstado(data));
		this.socket.on('getCompras', (data) => this.informarComprasEnProceso(data));
		this.socket.on('avanzarCompra', (data) => this.avanzarProcesamientoCompra(data));
		this.socket.on('finalizarEjecucion', (data) => this.bajarServidor(data));

		//Se persiste estado del servidor cada 1 minuto
		setInterval(this.guardarEstado, 60000);
	}

	//Metodos de tratamiento de eventos del Monitor
	//**************************************************
	informarEstado(data){
		var obj = this.getInfraccion(data.num_compra);
		var resp = {
			num_compra : obj? obj.data.num_compra : '---------',
			estado : obj? obj.estado.nombre : '---------',
			prox_eventos : obj? obj.eventosPendientes : '---------'	
		};

		this.socket.emit('estadoCompra', resp);
	}
	
	informarComprasEnProceso(data){
		var listado = new Array();
		_.each(this.infracciones, (item) =>{
			listado.push(item.num_compra);
		});
		this.socket.emit('listadoCompras', { listado_compras: listado});
	}
	
	avanzarProcesamientoCompra(data){
		var obj = this.getInfraccion(data.num_compra);
		this.stepper.emit('pasoManual', obj, data);
	}
	
	bajarServidor(data){
		process.exit(0);
	}
	//**************************************************//
		
	
	nuevaInfraccion(msg){
		var newInfraccion = new Infraccion(this, this.prox_num_infraccion, msg.data);
		
		this.infracciones.push(newInfraccion);

		this.stepper.emit('paso', newInfraccion, msg.evento, msg.data);
		
		this.prox_num_infraccion++;
	}

	getInfraccion(num_compra){
		return _.find(this.infracciones, (element) =>{
			return element.data.num_compra == num_compra;
		});
	}

	guardarEstado(){
		null;
	}

	logMonitor(msg){
		var data = {
			origen : 'infracciones_server',
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
						console.error('[Infracciones_server]: Error Creando canal: ' + err);
						obj.logMonitor('[Infracciones_server]: Error Creando canal: ' + err);
					});
			})
			.catch( function(err){
				console.error('[Infracciones_server]: Error conectando a servidor de mensajeria: ' + err);
				obj.logMonitor('[Infracciones_server]: Error conectando a servidor de mensajeria: ' + err);
			});
	}
}

var server = new ServidorInfracciones(process.argv[2]);

console.log('[Infracciones_server] en ejecución en modo: ' + server.modo);
server.logMonitor('[Infracciones_server] en ejecución en modo: ' + server.modo);
console.log('Esperando mensajes...');
server.logMonitor('Esperando mensajes...');
amqp.connect('amqp://localhost')
	.then(function(con){
		con.createChannel()
			.then(function(chn){
				var queue = 'infracciones_server';
				chn.assertQueue(queue, {durable : true});
				chn.consume(queue, (msg) => {
					var mensaje = JSON.parse(msg.content.toString());
					
					console.log('------------------------------------------');
					console.log('Mensaje recibido: %s', JSON.stringify(mensaje));
					console.log('------------------------------------------');
					server.logMonitor('Mensaje recibido:\\n' + JSON.stringify(mensaje));
					
					if (mensaje.evento === 'compraGenerada') {
						server.emit('nuevaInfraccion', mensaje);
					}else{
						var obj = server.getInfraccion(mensaje.data.num_compra);
						server.stepper.emit('paso', obj, msg.evento, msg.data);
					}
					
					chn.ack(msg);
				}, {noAck: false})
					.catch( function(err){
						console.error('[Infracciones_server]: Error al consumir mensajes: ' + err);
						server.logMonitor('[Infracciones_server]: Error al consumir mensajes: ' + err);
					});	
			})
			.catch(function(err){
				console.error('[Infracciones_server]: Error createChannel: '+ err);
				server.logMonitor('[Infracciones_server]: Error createChannel: '+ err);
			});
	})
	.catch(function (err){
		console.error('[Infracciones_server]: Error connect: ' + err);
		server.logMonitor('[Infracciones_server]: Error connect: ' + err);
	});





