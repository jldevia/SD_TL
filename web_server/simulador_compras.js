var ServidorWeb = require('./server_web');
var amqp = require('amqplib');
var sleep = require('sleep');

'use strict';

//Se levanta una instancia del servidor.
var server = new ServidorWeb();
//Se crean sesiones
server.emit('nuevaSesion', 5); //sesion 1
server.emit('nuevaSesion', 25);//sesion 2
server.emit('nuevaSesion', 12);//sesion 3
server.emit('nuevaSesion', 1);//sesion 4
server.emit('nuevaSesion', 10);//sesion 5
server.emit('nuevaSesion', 8);//sesion 6

var sesion1 = server.getSesionByUser(5);
var sesion2 = server.getSesionByUser(25);
var sesion3 = server.getSesionByUser(12);
var sesion4 = server.getSesionByUser(1);
var sesion5 = server.getSesionByUser(10);
var sesion6 = server.getSesionByUser(8);

//se inician compras
sesion1.emit('iniciarCompra', {publicacion_id : 1, cantidad: 1}); //Compra del producto 1 (publicacion 1), cantidad: 1
sesion2.emit('iniciarCompra', {publicacion_id : 2, cantidad: 2}); //Compra del producto 2 (publicacion 2), cantidad: 2
sleep.sleep(30);
sesion3.emit('iniciarCompra', {publicacion_id : 3, cantidad: 1}); //Compra del producto 3 (publicacion 3), cantidad: 1
sesion4.emit('iniciarCompra', {publicacion_id : 4, cantidad: 1}); //Compra del producto 4 (publicacion 4), cantidad: 1
sleep.sleep(30);
sesion5.emit('iniciarCompra', {publicacion_id : 10, cantidad: 2}); //Compra del producto 10 (publicacion 10), cantidad: 2
sesion6.emit('iniciarCompra', {publicacion_id : 6, cantidad: 3}); //Compra del producto 6 (publicacion 6), cantidad: 3
//

console.log('[Web_server] en ejecución....');
console.log('Esperando mensajes...');

amqp.connect('amqp://localhost')
	.then(function(con){
		con.createChannel()
			.then(function(chn){
				var queue = 'web_server';
				chn.assertQueue(queue, {durable : true});
				chn.consume(queue, (msg) => {
					var mensaje = JSON.parse(msg.content.toString());
					if (mensaje.evento === 'publicacionesSolicitadas') {
						server.emit(mensaje.evento, mensaje.data);
					}else{
						var sesion = server.getSesionById(mensaje.data.sesion_id);
						sesion.emit(mensaje.evento, mensaje.data);
						console.log('------------------------------------------');
						console.log('Mensaje recibido: %s', JSON.stringify(mensaje));
						console.log('------------------------------------------');
					}
				}, {noAck: false})
					.catch( function(err){
						console.error('[Simulador]: Error al consumir mensaje: ' + err);		
					});	
			})
			.catch(function(err){
				console.error('[Simulador]: Error createChannel: '+ err);
			});
	})
	.catch(function (err){
		console.error('[Simulador]: Error connect: ' + err);
	});
