var amqp = require  ('amqplib');
var _ = require('underscore');
const Infraccion = require('./infraccion');
const Stepper = require('../stepperEngine');
const util = require('../util');
const utilDB = require('../utilDB');
var snapshot = require('../snapshot');

const EventEmitter = require('events').EventEmitter;

//Clase que simula la ejecucion del servidor de "Infracciones"
class ServidorInfracciones extends EventEmitter{
	constructor (modo) {
		super();
		this.urlDB = 'mongodb://localhost:27017/infracciones_db';

		this.modo = modo || 'AUTOMATICO';
		this.prox_num_infraccion = 1;
		this.stepper = new Stepper(this.modo, 2);

		//Snapshot
		this.snapshot = snapshot();
		this.snapshot.origen_corte = 'infracciones';
		this.cantidad_fin_corte = 5;


		//DB in memory: Infracciones en proceso o procesadas
		this.infracciones = new Array();

		this.on('nuevaInfraccion', (msg) => this.nuevaInfraccion(msg));
		this.on('corte', (data) => this.procesarCorte(data));
		
		//webSocket de comunicacion con el monitor
		this.socket = require('socket.io-client')('http://localhost:17852', {
			query : {
				origen : 'infracciones'
			},
			transports : ['websocket']
		});
		
		this.socket.on('getEstadoCompra', (data)=> this.informarEstado(data));
		this.socket.on('getCompras', (data) => this.informarComprasEnProceso(data));
		this.socket.on('avanzarCompra', (data) => this.avanzarProcesamientoCompra(data));
		this.socket.on('finalizarEjecucion', (data) => this.bajarServidor(data));
		this.socket.on('corte', () => this.iniciarCorte());

		//Se persiste estado del servidor cada 1 minuto
		// setInterval(function(url, registros){
		// 	utilDB.guardarEstado(url, registros);
		// }, 60000, this.urlDB, this.infracciones);
	}

	//Metodos de tratamiento de eventos del Monitor
	//**************************************************
	informarEstado(data){
		var obj = this.getInfraccion(data.num_compra);
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
		_.each(this.infracciones, (item) =>{
			listado.push(item.num_compra);
		});
		this.socket.emit('listadoCompras', { listado_compras: listado});
	}
	
	avanzarProcesamientoCompra(data){
		var obj = this.getInfraccion(data.num_compra);
		this.stepper.emit('pasoManual', obj, data.arg);
	}
	
	bajarServidor(data){
		process.exit(0);
	}

	//Snapshot
	iniciarCorte(){
		console.log('Iniciando corte en infracciones ...');
		
		this.snapshot.setEstadoProceso(this.infracciones);
		this.snapshot.en_corte = true;
		this.snapshot.estado_clock = this.stepper.clock.slice(0);
		var topico = '.envios.compras.pagos.publicaciones.web.';
		var msg = {
			evento : 'corte',
		};
		this.publicarMensaje(topico, msg);

		//Se encolan los mensajes pendientes de procesamiento
		// _.forEach(this.infracciones, (item) =>{
		// 	_.forEach(item.eventosPendientes, (element) => {
		// 		this.snapshot.encolarMensaje(JSON.parse(JSON.stringify(element)));
		// 	});
		// });
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

	logMonitor(msg){
		var data = {
			origen : 'infracciones_server',
			mensaje: util.formatearMsg(msg)
		};
		this.socket.emit('logMensaje', data);
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
			origen : 'infracciones',
			estado_proceso : this.snapshot.estado_proceso,
			estado_channels : this.snapshot.getAllChannels(),
			clock : this.snapshot.estado_clock
		};

		this.socket.emit('logSnapshot', msg);
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
						mensaje.origen = 'infracciones';
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
					}else if (mensaje.evento == 'corte'){
						//Snapshot
						server.emit('corte', mensaje);
					}else{
						var obj = server.getInfraccion(mensaje.data.num_compra);
						server.stepper.emit('paso', obj, msg.evento, msg.data);
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





