var SesionWeb = require('./sesion_web');
var EventEmitter = require('events').EventEmitter;
var amqp = require('amqplib');
var _ = require('underscore');
const Stepper = require('../stepperEngine');
const util = require('../util');
const utilDB = require('../utilDB');
var snapshot = require('../snapshot');

'use strict';

class ServidorWeb extends EventEmitter{
	constructor(modo){
		super();
		this.urlDB = 'mongodb://localhost:27017/web_db';

		this.modo = modo || 'AUTOMATICO';
		this.prox_num_sesion = 1;
		this.stepper = new Stepper(this.modo, 0);

		//Snapshot
		this.snapshot = snapshot();
		this.snapshot.origen_corte = 'compras';
		this.cantidad_fin_corte = 5;


		//DB in memory: Infracciones en proceso o procesadas
		this.sesiones = new Array();
		this.publicaciones = new Array();

		//socket de comunicacion con el monitor
		this.socket = require('socket.io-client')('http://localhost:17852', {
			query : {
				origen : 'web'
			},
			transports : ['websocket']
		});

		//Dashboard
		this.dashboard = new Object();
		this.dashboard.cant_compras = 0;
		this.dashboard.cant_compras_canceladas = 0;
		this.dashboard.cant_compras_rechazadas = 0;
		this.dashboard.cant_pagos_rechazados = 0;
		this.dashboard.cant_compras_concretadas = 0;

		//Eventos provenientes del monitor
		this.socket.on('iniciarNuevaCompra', (data) => this.iniciarNuevaCompra(data));
		this.socket.on('getEstadoCompra', (data)=> this.informarEstado(data));
		this.socket.on('getCompras', (data) => this.informarComprasEnProceso(data));
		this.socket.on('avanzarCompra', (data) => this.avanzarProcesamientoCompra(data));
		this.socket.on('finalizarEjecucion', (data) => this.bajarServidor(data));
		this.socket.on('corte', () => this.iniciarCorte());

		//Eventos que escucha el servidor
		this.on('nuevaSesion', (comprador_id) => this.iniciarSesion(comprador_id));
		this.on('iniciaCompra', (usuario_id, data) => this.iniciarCompra(usuario_id, data));
		this.on('finalizaSesion', (sesion_id) => this.terminarSesion(sesion_id));
		this.on('solicitudPublicaciones', () => this.solicitarPublicaciones());
		this.on('publicacionesSolicitadas', (data) => this.recibirPublicaciones(data));
		this.on('compraFinalizada', (data) => this.actualizarDashBoard(data));
		this.on('corte', (data) => this.procesarCorte(data));

		//Se guarda estado cada  minuto
		// setInterval(function(url, registros){
		// 	utilDB.guardarEstado(url, registros);
		// }, 60000, this.urlDB, this.sesiones);

		// if (this.modo === 'AUTOMATICO'){
		// 	setInterval(function(obj){
		// 		obj.iniciarCorte();
		// 	}, 25000, this);
		// }
	}

	//Metodos de tratamiento de eventos del Monitor
	//**************************************************
	iniciarNuevaCompra(data){
		this.emit('nuevaSesion', data.usuario_id);
		
		//Se avanza manualmente hasta obtener la compra generada por parte de Compras
		var obj = this.getSesionByUser(data.usuario_id);
		this.stepper.emit('paso', obj, 'iniciarCompra', data);
		
		this.stepper.emit('pasoManual', obj, {
			publicacion_id : data.publicacion_id,
			cantidad : data.cantidad
		}); // iniciarCompra/iniciarCompra
		this.stepper.emit('pasoManual', obj);// nuevaCompraIniciada/informarNuevaCompra
	}
	
	informarEstado(data){
		var obj = this.getSesionByNumCompra(data.num_compra);
		var resp;
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
		_.each(this.sesiones, (item) =>{
			listado.push(item.data.num_compra);
		});
		this.socket.emit('listadoCompras', { listado_compras: listado});
	}
	
	avanzarProcesamientoCompra(data){
		var obj = this.getSesionByNumCompra(data.num_compra);
		this.stepper.emit('pasoManual', obj, data.arg);
	}
	
	bajarServidor(data){
		process.exit(0);
	}

	//Snapshot
	iniciarCorte(){
		console.log('Iniciando corte en web ...');
		
		this.snapshot.setEstadoProceso(this.sesiones);
		this.snapshot.en_corte = true;
		this.snapshot.estado_clock = this.stepper.clock.slice(0);
		var topico = '.envios.infracciones.pagos.publicaciones.compras.';
		var msg = {
			evento : 'corte',
		};
		this.publicarMensaje(topico, msg);

		//Se encolan los mensajes pendientes de procesamiento
		// _.forEach(this.sesiones, (item) =>{
		// 	_.forEach(item.eventosPendientes, (element) => {
		// 		console.log('Mensaje encolado: ' + element.toString());
		// 		this.snapshot.encolarMensaje(JSON.parse(JSON.stringify(element)));
		// 	});
		// });
	}
	//**************************************************

	iniciarSesion(usuario_id){
		var newSesion = new SesionWeb(this, this.prox_num_sesion, usuario_id);
		this.sesiones.push(newSesion);
		this.prox_num_sesion++;
	}

	iniciarCompra(usuario_id, data){
		var sesion = this.getSesionByUser(usuario_id);
		if(sesion){
			this.stepper.emit('paso', sesion, 'iniciarCompra', data);
		}else{
			console.log('El usuario indicado '+ usuario_id + 'no ha iniciado sesión.');
		}
	}

	terminarSesion(sesion_id){
		_.each(this._sesiones, (element, index) =>{
			if (element.sesion_id === sesion_id) {
				this._sesiones.splice(index, 1);
			}	
		});
	}

	solicitarPublicaciones(){
		var mensaje = new Object();
		mensaje.evento = 'devolverPublicaciones';
		mensaje.data = {
			solicita: 'web'
		};
		var topico = '.publicaciones.';
		this.publicarMensaje(topico, JSON.stringify(mensaje));
	}

	recibirPublicaciones(data){
		_.each(data, (element) =>{
			this._publicaciones.push(element);
			console.log('------------------------------------------');
			console.log('Publicacion recibida: ' + element);
			console.log('------------------------------------------');
			//this.logMonitor('Publicacion recibida: ' + element);
		});
	}

	getSesionById(sesion_id){
		return _.find(this.sesiones, (element) =>{
			return (element.sesion_id == sesion_id);
		});
	}

	getSesionByUser(user_id){
		return _.find(this.sesiones, (element) => {
			return (element.usuario_id == user_id); 
		});
	}

	getSesionByNumCompra(num_compra){
		return _.find(this.sesiones, (element) => {
			return (element.data.num_compra == num_compra); 
		});
	}

	actualizarDashBoard(estado){
		switch (estado) {
		case 'COMPRA_CANCELADA':
			this.dashboard.cant_compras = this.dashboard.cant_compras + 1;
			this.dashboard.cant_compras_canceladas = this.dashboard.cant_compras_canceladas + 1;	
			break;
		case 'COMPRA_RECHAZADA':
			this.dashboard.cant_compras = this.dashboard.cant_compras + 1;
			this.dashboard.cant_compras_rechazadas = this.dashboard.cant_compras_rechazadas + 1;
			break;
		case 'COMPRA_CONCRETADA':
			this.dashboard.cant_compras = this.dashboard.cant_compras + 1;
			this.dashboard.cant_compras_concretadas = this.dashboard.cant_compras_concretadas + 1;
			break;	
		case 'PAGO_RECHAZADO':
			this.dashboard.cant_compras = this.dashboard.cant_compras + 1;
			this.dashboard.cant_pagos_rechazados = this.dashboard.cant_pagos_rechazados + 1;
			break;
		}
		this.socket.emit('logDashboard', this.dashboard);
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
			origen : 'web',
			estado_proceso : this.snapshot.estado_proceso,
			estado_channels : this.snapshot.getAllChannels(),
			clock : this.snapshot.estado_clock
		};

		this.socket.emit('logSnapshot', msg);
	}

	logMonitor(msg){
		var data = {
			origen : 'web_server',
			mensaje : util.formatearMsg(msg) 
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
						mensaje.origen = 'web';
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
						console.error('[ServidorWeb]: Error Creando canal: ' + err);
						obj.logMonitor('[ServidorWeb]: Error Creando canal: ' + err);
					});
			})
			.catch( function(err){
				console.error('[ServidorWeb]: Error conectando a servidor de mensajeria: ' + err);
				obj.logMonitor('[ServidorWeb]: Error conectando a servidor de mensajeria: ' + err);
			});
	}


}

var servidor = new ServidorWeb(process.argv[2]);
console.log('[Web_server] en ejecución en modo ' + servidor.modo);
servidor.logMonitor('[Web_server] en ejecución en modo ' + servidor.modo);
console.log('Esperando mensajes...');
servidor.logMonitor('Esperando mensajes...');

amqp.connect('amqp://localhost')
	.then(function(con){
		con.createChannel()
			.then(function(chn){
				var queue = 'web_server';
				chn.assertQueue(queue, {durable : true});
				chn.consume(queue, (msg) => {
					var mensaje = JSON.parse(msg.content.toString());
					
					console.log('------------------------------------------');
					console.log('Mensaje recibido: %s', JSON.stringify(mensaje));
					console.log('------------------------------------------');
					servidor.logMonitor('Mensaje recibido:\\n' + JSON.stringify(mensaje));
					
					if (mensaje.evento === 'publicacionesSolicitadas') {
						servidor.emit(mensaje.evento, mensaje.data);
					}else if (mensaje.evento === 'corte'){
						//Snapshot
						servidor.emit('corte', mensaje);
					}else{
						var sesion = servidor.getSesionById(mensaje.data.sesion_id);
						servidor.stepper.emit('paso', sesion, mensaje.evento, mensaje.data);
						//Se actualiza reloj vectorial
						util.actualizarReloj(servidor.stepper.clock, mensaje.clock);
						//Snapshot
						if (servidor.snapshot.en_corte){
							servidor.snapshot.encolarMensaje(JSON.parse(JSON.stringify(mensaje)));
						}
					}
					chn.ack(msg);
				}, {noAck: false})
					.catch( function(err){
						console.error('[Web_server]: Error al consumir mensaje: ' + err);
						servidor.logMonitor('[Web_server]: Error al consumir mensaje: ' + err);		
					});	
			})
			.catch(function(err){
				console.error('[Web_server]: Error createChannel: '+ err);
				servidor.logMonitor('[Web_server]: Error createChannel: '+ err);
			});
	})
	.catch(function (err){
		console.error('[Web_server]: Error connect: ' + err);
		servidor.logMonitor('[Web_server]: Error connect: ' + err);
	});


module.exports.server = servidor;