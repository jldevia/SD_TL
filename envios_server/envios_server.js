var amqp = require  ('amqplib');
var _ = require('underscore');
const EventEmitter = require('events').EventEmitter;
const Envio = require('./envio');
const Stepper = require('../stepperEngine');
const util = require('../util');
const utilDB = require('../utilDB');
var snapshot = require('../snapshot');

//Clase que simula la ejecucion del servidor de "Envios"
class ServidorEnvios extends EventEmitter{
	constructor(modo){
		super();
		this.urlDB = 'mongodb://localhost:27017/envios_db';

		this.modo = modo || 'AUTOMATICO';
		this.prox_num_envio = 1;
		this.stepper = new Stepper(this.modo, 3);

		//Snapshot
		this.snapshot = snapshot();
		this.snapshot.origen_corte = 'envios';
		this.cantidad_fin_corte = 5;
		

		//DB in memory: Envios en proceso o procesados
		this.envios = new Array();

		this.on('nuevoEnvio', (msg) => this.nuevoEnvio(msg));
		this.on('corte', (data) => this.procesarCorte(data));
				
		//socket de comunicacion con el monitor
		this.socket = require('socket.io-client')('http://localhost:17852', {
			query : {
				origen : 'envios'
			},
			transports : ['websocket']
		});

		this.socket.on('getEstadoCompra', (data)=> this.informarEstado(data));
		this.socket.on('getCompras', (data) => this.informarComprasEnProceso(data));
		this.socket.on('avanzarCompra', (data) => this.avanzarProcesamientoCompra(data));
		this.socket.on('finalizarEjecucion', (data) => this.bajarServidor(data));
		this.socket.on('corte', () => this.iniciarCorte());

		//Se guarda estado cada un minuto
		// setInterval( function(url, registros){
		// 	utilDB.guardarEstado(url, registros);
		// }, 60000, this.urlDB, this.envios);
	}

	//Metodos de tratamiento de eventos del Monitor
	//**************************************************
	informarEstado(data){
		var obj = this.getEnvio(data.num_compra);
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
				num_compra : obj.data.num_compra? obj.data.num_compra: 'Compra Inexistente',
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
		_.each(this.envios, (item) =>{
			listado.push(item.num_compra);
		});
		this.socket('listadoCompras', { listado_compras: listado});
	}
	
	avanzarProcesamientoCompra(data){
		var obj = this.getEnvio(data.num_compra);
		this.stepper.emit('pasoManual', obj, data.arg);
	}
	
	bajarServidor(data){
		process.exit(0);
	}

	//Snapshot
	iniciarCorte(){
		console.log('Iniciando corte en envios ...');
		
		this.snapshot.setEstadoProceso(this.envios);
		this.snapshot.en_corte = true;
		this.snapshot.estado_clock = this.stepper.clock.slice(0);
		//console.log('snapshot iniciado: ' + JSON.stringify(this.snapshot));
		var topico = '.compras.infracciones.pagos.publicaciones.web.';
		var msg = {
			evento : 'corte',
		};
		this.publicarMensaje(topico, msg);

		//Se encolan los mensajes pendientes de procesamiento
		// _.forEach(this.envios, (item) =>{
		// 	_.forEach(item.eventosPendientes, (element) => {
		// 		this.snapshot.encolarMensaje(JSON.parse(JSON.stringify(element)));
		// 		console.log('Mensaje encolado: ' + JSON.stringify(element));
		// 	});
		// });
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
			origen : 'envios',
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
						mensaje.origen = 'envios';
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
					}else if (mensaje.evento == 'corte'){
						//Snapshot
						server.emit('corte', mensaje);
					}else{
						var obj = server.getEnvio(mensaje.data.num_compra);
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
