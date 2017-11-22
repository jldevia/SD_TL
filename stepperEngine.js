'use strict';

const EventEmitter = require ('events').EventEmitter;
var util = require('util');
const _ = require('underscore');

var Stepper = function(modo, index_server){
	this.modo = modo || 'AUTOMATICO'; //Se configura en modo automático por defecto
	
	//Reloj vectorial
	// Posiciones:
	// 0: web
	// 1: Compras
	// 2: Infracciones
	// 3: Envios
	// 4: Pagos
	// 5: Publicaciones
	this.clock = [0, 0, 0, 0, 0, 0];
		
	this.clock_position = index_server;
	
	console.log('Arranca Stepper en modo: ' + this.modo);

	this.on('paso', function(obj, transicion, data){
		try {
			switch (this.modo) {
			case 'AUTOMATICO':
				console.log('[Stepper] - Se dispara la transición ' + transicion);
				this.incrementarClock();
				obj.emit(transicion, data);	
				break;
			case 'PAP':
				console.log('[Stepper] - Se "encola" la transición ' + transicion);
				obj.eventosPendientes.push({evento : transicion, data : data});
				break;
			default:
				console.log('Modo de ejecución no soportado.');
				break;
			}
				
			var prox_transiciones = obj.estado.transicion_out;
			if (prox_transiciones){
				prox_transiciones.forEach(function(item) {
					//Para evitar "encolar" indefinidamente un proximo evento
					if (_.findIndex(obj.eventosPendientes, {evento : item})  === -1){
						this.emit('paso', obj, item, obj.data);
					}
				}, this);
			}
		} catch (err) {
			console.log('[Stepper] - Evento "paso". Error inesperado: ' + err);
		}
	});

	this.on('pasoManual', function(obj, data){
		var evento = obj.eventosPendientes.shift();
		if (evento) {
			try {
				var auxData = data || evento.data || obj.data;
				//console.log('Data: ' + JSON.stringify(auxData));
				this.incrementarClock();

				obj.emit(evento.evento, auxData);
				
				var prox_transiciones = obj.estado.transicion_out;
				if (prox_transiciones){
					prox_transiciones.forEach(function(item) {
						obj.eventosPendientes.push({evento: item, data: obj.data});
					}, this);
				}
			} catch (err) {
				console.log('[Stepper] - Evento "pasoManual". Error inesperado: ' + err);
			}
		}
	});

	this.incrementarClock = function (){
		this.clock[this.clock_position] = this.clock[this.clock_position] + 1;
		//console.log('Reloj: ' + this.clock);
	};
		
};

util.inherits(Stepper, EventEmitter);

module.exports = Stepper; 

