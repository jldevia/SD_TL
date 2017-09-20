var Compra = require('./compra');
var _ = require('underscore');
var amqp = require('amqplib');

'use strict';

class ServidorCompras {
	constructor(){
		this._compras = [];
		this.prox_num_compra = 1;
	}

	generarNuevaCompra(data){
		var newCompra = new Compra();
		data.num_compra = this.prox_num_compra;
		newCompra.emit('nuevaCompra', data);
		this._compras.push(newCompra);
		console.log('------------------------------------------');
		console.log('Compra generada N° : %d', this.prox_num_compra);
		console.log('Datos: %s', JSON.stringify(data));
		console.log('------------------------------------------');
		this.prox_num_compra++;
	}

	eliminarCompra(num_compra){
		_.each(this._compras, (element, index) => {
			if ( element.num_compra == num_compra ){
				this._compras.splice(index, 1);
			}
		});
	}

	getCompraByNum(num_compra){
		return _.find(this._compras, (element) =>{
			return (element.num_compra === num_compra);
		});
	}

	get compras(){
		return this._compras;
	}

}

var server = new ServidorCompras();

console.log('[Compras_server] en ejecución....');
console.log('Esperando mensajes...');

amqp.connect('amqp://localhost')
	.then(function(con){
		con.createChannel()
			.then(function(chn){
				var queue = 'compras_server';
				chn.assertQueue(queue, {durable : true});
				chn.consume(queue, (msg) => {
					var mensaje = JSON.parse(msg.content.toString());
					if (mensaje.evento === 'nuevaCompra') {
						server.generarNuevaCompra(mensaje.data);
					}else{
						var compra = server.getCompraByNum(mensaje.data.num_compra);
						compra.emit(mensaje.evento, mensaje.data);
						console.log('------------------------------------------');
						console.log('Mensaje recibido: %s', JSON.stringify(mensaje));
						console.log('------------------------------------------');
					}	
				}, {noAck: false})
					.catch( function(err){
						console.error('[Server_compras]: Error al consumir mensajes: ' + err);
					});	
			})
			.catch(function(err){
				console.error('[Server_compras]: Error createChannel: '+ err);
			});
	})
	.catch(function (err){
		console.error('[Server_compras]: Error connect: ' + err);
	});
