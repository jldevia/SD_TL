var amqp = require  ('amqplib');
var _ = require('underscore');
const EventEmitter = require('events').EventEmitter;
const Envio = require('./envio');
const Stepper = require('../stepperEngine');
const util = require('../util');

//Clase que simula la ejecucion del servidor de "Envios"
class ServidorEnvios extends EventEmitter{
	constructor(modo){
		super();

		this.modo = modo || 'AUTOMATICO';
		this.prox_num_envio = 1;
		this.stepper = new Stepper(this.modo);

		//DB in memory: Envios en proceso o procesados
		this.envios = new Array();

		this.on('nuevoEnvio', (msg) => this.nuevoEnvio(msg));
		
		//socket de comunicacion con el monitor
		this.socket = require('socket.io-client')('http://localhost:17852', {
			query : {
				origen : 'envios'
			}
		});

		this.socket.on('getEstadoCompra', (data)=> this.informarEstado(data));
		this.socket.on('getCompras', (data) => this.informarComprasEnProceso(data));
		this.socket.on('avanzarCompra', (data) => this.avanzarProcesamientoCompra(data));
		this.socket.on('finalizarEjecucion', (data) => this.bajarServidor(data));

		setInterval(this.guardarEstado, 60000);
		
	}

	//Metodos de tratamiento de eventos del Monitor
	//**************************************************
	informarEstado(data){
		var obj = this.getEnvio(data.num_compra);
		var resp = {
			num_compra : obj? obj.num_compra: '---------',
			estado : obj? obj.estado.nombre : '---------',
			prox_eventos : obj? obj.eventosPendientes : '---------'	
		};

		this.socket.emit('estadoCompra', resp);
	}

	informarComprasEnProceso(data){
		var listado = new Array();
		_.each(this.envios, (item) =>{
			listado.push(item.num_compra);
		});
		this.socket('listadoCompras', { listado_compras: listado});
	}
	
	avanzarProcesamientoCompra(data){
		var obj = this.getEnvio(data.num_compra);
		this.stepper.emit('pasoManual', obj, data);
	}
	
	bajarServidor(data){
		process.exit(0);
	}
	//**************************************************//

	nuevoEnvio(msg){
		var newEnvio = new Envio(this, this.prox_num_envio, msg.data);

		this.envios.push(newEnvio);

		this.stepper.emit('paso', newEnvio, msg.evento, msg.data);
		
		this.prox_num_envio++;
	}

	getEnvio(num_compra){
		return _.find(this.envios, function(item){
			return item.data.num_compra == num_compra;
		});
	}

	logMonitor(msg){
		var data = {
			origen : 'envios_server',
			mensaje : util.formatearMsg(msg)
		};
		this.socket.emit('logMensaje', data);
	}

	guardarEstado(){
		null;
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
						console.error('[Envios_server]: Error Creando canal: ' + err);
						obj.logMonitor('[Envios_server]: Error Creando canal: ' + err);
					});
			})
			.catch( function(err){
				console.error('[Envios_server]: Error conectando a servidor de mensajeria: ' + err);
				obj.logMonitor('[Envios_server]: Error conectando a servidor de mensajeria: ' + err);
			});
	}
}

var server = new ServidorEnvios(process.argv[2]);

console.log('[Envios_server] en ejecución en modo '+ server.modo);
server.logMonitor('[Envios_server] en ejecución en modo' + server.modo);
console.log('Esperando mensajes...');
server.logMonitor('Esperando mensajes...');
amqp.connect('amqp://localhost')
	.then(function(con){
		con.createChannel()
			.then(function(chn){
				var queue = 'envios_server';
				chn.assertQueue(queue, {durable : true});
				chn.consume(queue, (msg) => {
					var mensaje = JSON.parse(msg.content.toString());
					
					console.log('------------------------------------------');
					console.log('Mensaje recibido: %s', JSON.stringify(mensaje));
					console.log('------------------------------------------');
					server.logMonitor('Mensaje recibido:\\n' + JSON.stringify(mensaje));
					
					if (mensaje.evento === 'calcularCostoEnvio'){
						server.emit('nuevoEnvio', mensaje);
					}else{
						var obj = server.getEnvio(mensaje.data.num_compra);
						server.stepper.emit('paso', obj, mensaje.evento, mensaje.data);
					}
					chn.ack(msg);
				}, {noAck: false})
					.catch( function(err){
						console.error('[Envios_server]: Error al consumir mensajes: ' + err);
						server.logMonitor('[Envios_server]: Error al consumir mensajes: '+err);
					});	
			})
			.catch(function(err){
				console.error('[Envios_server]: Error creando canal: '+ err);
				server.logMonitor('[Envios_server]: Error creando canal: '+ err);
			});
	})
	.catch(function (err){
		console.error('[Envios_server]: Error conexión servidor mensajería: ' + err);
		server.logMonitor('[Envios_server]: Error al conectar con servidor mensajería: ' + err);
	});
