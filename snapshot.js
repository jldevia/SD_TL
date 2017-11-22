var _ = require('underscore');

'use strict';

//Estructura de Datos para la implementación del algoritmo "Snapshot" de Chandy-Lamport
var Snapshot = function (){
	var en_corte = false;
	var estado_proceso = new Array();
	var estado_clock;
	var buffer_channel = new Array();
	var channels_in = {
		channel_compras : new Array(),
		channel_web : new Array(),
		channel_publicaciones : new Array(),
		channel_infracciones : new Array(),
		channel_envios : new Array(),
		channel_pagos : new Array()
	};
	var origen_corte = '';
	var contador = 0;

	function guardarMensaje(msg){
		switch (msg.origen) {
		case 'compras':
			channels_in.channel_compras.push(msg);	
			break;
		case 'web':
			channels_in.channel_web.push(msg);
			break;
		case 'publicaciones':
			channels_in.channel_publicaciones.push(msg);
			break;
		case 'infracciones':
			channels_in.channel_infracciones.push(msg);
			break;
		case 'pagos':
			channels_in.channel_pagos.push(msg);
			break;
		case 'envios':
			channels_in.channel_envios.push(msg);
			break;				
		default:
			console.log('Origen del mensaje desconocido');
			break;
		}
	}

	function guardarEstadoChannel(origen){
		_.find(buffer_channel, (item) =>{
			if (item.origen === origen){
				guardarMensaje(item);
			}
		});
	}

	function encolarMensaje(msg){
		//console.log('Mensaje encolado: ' + JSON.stringify(msg));
		if (msg.origen != origen_corte){
			buffer_channel.push(msg);
		}
	}

	function getChannel(origen){
		switch (origen) {
		case 'compras':
			return channels_in.channel_compras;
		case 'web':
			return channels_in.channel_web;
		case 'publicaciones':
			return channels_in.channel_publicaciones;
		case 'infracciones':
			return channels_in.channel_infracciones;
		case 'pagos':
			return channels_in.channel_pagos;
		case 'envios':
			return channels_in.channel_envios;
		default:
			console.log('Origen del mensaje desconocido');
		}
	}

	function getAllChannels (){
		return channels_in;
	}

	function setEstadoProceso(estado){
		//console.log('[Snapshot] - Estado: ' + estado);
		_.forEach(estado, (item) =>{
			//console.log('[Snapshot] - Objeto: ' + item);
			estado_proceso.push(JSON.parse(JSON.stringify(item.data)));
		});
	}

	return {
		en_corte : en_corte,
		setEstadoProceso : setEstadoProceso,
		estado_proceso : estado_proceso,
		estado_clock : estado_clock,
		encolarMensaje: encolarMensaje,
		origen_corte : origen_corte,
		contador : contador,
		guardarEstadoChannel : guardarEstadoChannel,
		getAllChannels : getAllChannels,
		getChannel : getChannel
	};
};

module.exports = Snapshot;