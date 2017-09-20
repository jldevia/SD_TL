var SesionWeb = require('./sesion_web');
var EventEmitter = require('events').EventEmitter;
var amqp = require('amqplib');
var _ = require('underscore');

'use strict';

class ServidorWeb extends EventEmitter{
	constructor(){
		super();
		this._sesiones = [];
		this._publicaciones = [];
		this.prox_num_sesion = 1;

		//Eventos que escucha el servidor
		this.on('nuevaSesion', (comprador_id) => this.iniciarSesion(comprador_id));
		this.on('finalizaSesion', (sesion_id) => this.terminarSesion(sesion_id));
		this.on('solicitudPublicaciones', () => this.solicitarPublicaciones());
		this.on('publicacionesSolicitadas', (data) => this.recibirPublicaciones(data));
		
	}

	iniciarSesion(comprador_id){
		var newSesion = new SesionWeb(this.prox_num_sesion, comprador_id, 'SIMULACION');
		this._sesiones.push(newSesion);
		this.prox_num_sesion++;
	}

	terminarSesion(sesion_id){
		_.each(this._sesiones, (element, index) =>{
			if (element.compras.sesion_id = sesion_id) {
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
		});
	}

	getSesionById(sesion_id){
		return _.find(this._sesiones, (element) =>{
			return (element.sesion_id === sesion_id);
		});
	}

	getSesionByUser(user_id){
		return _.find(this._sesiones, (element) => {
			return (element.compra.comprador === user_id); 
		});
	}

	get sesiones(){
		return this._sesiones;
	}

	publicarMensaje(topico, mensaje){
		amqp.connect('amqp://localhost')
			.then(function(con){
				con.createChannel()
					.then(function(chnl){
						var ex = 'compras.topic';
						chnl.assertExchange(ex, 'topic', {durable: true});
						chnl.publish(ex, topico, new Buffer(mensaje));
						console.log('------------------------------------------');
						console.log('Enviando Mensaje...');
						console.log('Topico: %s. Mensaje: ', topico, mensaje);
						console.log('------------------------------------------');
					})
					.catch(function(err){
						console.error('[ServidorWeb]: Error Creando canal: ' + err);
					});
			})
			.catch( function(err){
				console.error('[ServidorWeb]: Error conectando a servidor de mensajeria: ' + err);
			});
	}


}

module.exports = ServidorWeb;