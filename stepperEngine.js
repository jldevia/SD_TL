"use strict";

const EventEmitter = require ('events').EventEmitter;
var util = require('util');

var Stepper = function(modo){
	this.modo = modo || 'AUTOMATICO'; //Se configura en modo automático por defecto
	
	console.log('Arranca Stepper en modo: ' + this.modo);

	this.on('paso', function(obj, transicion, data){
		try {
			switch (this.modo) {
			case 'AUTOMATICO':
				console.log('[Stepper] - Se dispara la transición ' + transicion);
				obj.emit(transicion, data);	
				break;
			case 'PAP':
				console.log('[Stepper] - Se "encola" la transición ' + transicion);
				obj.eventosPendientes.push(transicion);
				obj.data_pendiente = data;
				break;
			default:
				console.log('Modo de ejecución no soportado.');
				break;
			}
				
			var prox_transiciones = obj.estado.transicion_out;
			if (prox_transiciones){
				prox_transiciones.forEach(function(item) {
					//Para evitar "encolar" indefinidamente un proximo evento
					if (obj.eventosPendientes.indexOf(item) = -1){
						this.emit('paso', obj, item, obj.data);
					}
				}, this);
			}
			
			function eventoEncolado(evento){
				var result = obj.eventosPendientes.indexOf(evento);
				if (result >= 0){
					return true
				}else{
					return false;
				}
			}
		} catch (err) {
			console.log('[Stepper] - Evento "paso". Error inesperado: ' + err);
		}
	});

	this.on('pasoManual', function(obj, data){
		var evento = obj.eventosPendientes.shift();
		console.log(evento);
		if (evento) {
			try {
				var auxData = obj.data_pendiente || data || obj.data;
				//console.log(auxData);

				obj.emit(evento, auxData);
				
				var prox_transiciones = obj.estado.transicion_out;
				if (prox_transiciones){
					prox_transiciones.forEach(function(item) {
						obj.eventosPendientes.push(item);
					}, this);
				}
			} catch (err) {
				console.log('[Stepper] - Evento "pasoManual". Error inesperado: ' + err);
			}
		}
	});

		
};

util.inherits(Stepper, EventEmitter);

module.exports = Stepper; 

