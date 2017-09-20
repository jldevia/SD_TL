var amqp = require  ('amqplib');
var Publication = require('./models/publication');
const EventEmitter = require('events').EventEmitter;

'use strict';

class ServidorPublicaciones extends EventEmitter{
	constructor(){
		super();
		
		//Registro de eventos
		this.on('devolverPublicaciones', (data) => this.enviarPublicaciones(data));
		this.on('compraGenerada', (data) => this.procesarCompraGenereda(data));
		this.on('resultadoInfraccion', (data) => this.procesarResultadoInfraccion(data));
		this.on('autorizacionPago', (data) => this.procesarAutorizacionPago(data));
		this.on('enviarProducto', (data) => this.procesarEnvioProducto(data));

		//Publication.runSeeder();
		
	}

	enviarPublicaciones(data){
		var topico = '.'+data.solicita+'.';
		var mensaje = new Object();
		mensaje.evento = 'publicacionesSolicitadas';
		Publication.find(function(err, result){
			if(err){
				mensaje.data = { 
					estado : 'Error', 
					mensaje: '[Pubicaciones_Server]: Error al recuperar listado de publicaciones'
				};
			}else{
				mensaje. data = result.toJSON();
			}
		});

		this.publicarMensaje(topico, JSON.stringify(mensaje));

	}

	procesarCompraGenereda(data){
		Publication.reservarProducto(data.publicacion_id, data.cantidad, function(err, publi){
			if (err) {
				console.error('[Publicaciones_server]: Error al reservar producto: '+ err);
			}else{
				console.log('[Publicaciones_server]: Producto reservado: ' + publi);
			}
		});
	}

	procesarResultadoInfraccion(data){
		if ( data.resultado === 'conInfraccion' ){
			Publication.liberarProducto(data.publicacion_id, data.cantidad, function(err, publi){
				if (err) {
					console.error('[Publicaciones_server]: Error al liberar producto: '+ err);
				}else{
					console.log('[Publicaciones_server]: Producto liberado: ' + publi);
				}
			});
		}
	}

	procesarAutorizacionPago(data){
		if ( data.rechazado === 'V' ){
			Publication.liberarProducto(data.publicacion_id, data.cantidad, function(err, publi){
				if (err) {
					console.error('[Publicaciones_server]: Error al liberar producto: '+ err);
				}else{
					console.log('[Publicaciones_server]: Producto liberado: ' + publi);
				}
			});
		}
	}

	procesarEnvioProducto(data){
		Publication.enviarProducto(data.publicacion_id, data.cantidad, function(err, publi){
			if (err) {
				console.error('[Publicaciones_server]: Error al enviar producto: '+ err);
			}else{
				console.log('[Publicaciones_server]: Producto enviado: ' + publi);
			}
		});
	}

	publicarMensaje(topico, mensaje){
		amqp.connect('amqp://localhost')
			.then(function(con){
				con.createChannel()
					.then(function(chnl){
						var ex = 'compras.topic';
						chnl.assertExchange(ex, 'topic', {durable: true});
						chnl.publish(ex, topico, new Buffer(mensaje));
						console.log(' [x] Enviando %s: \'%s\'', topico, mensaje);
					})
					.catch(function(err){
						console.error('[Publicaciones_server]: Error Creando canal: ' + err);
					});
			})
			.catch( function(err){
				console.error('[Publicaciones_server]: Error conectando a servidor de mensajeria: ' + err);
			});
	}
}

var server = new ServidorPublicaciones();

console.log('[Publicaciones_server] en ejecución....');
console.log('Esperando mensajes...');
amqp.connect('amqp://localhost')
	.then(function(con){
		con.createChannel()
			.then(function(chn){
				var queue = 'publicaciones_server';
				chn.assertQueue(queue, {durable : true});
				chn.consume(queue, (msg) => {
					var mensaje = JSON.parse(msg.content.toString());
					server.emit(mensaje.evento, mensaje.data);
					console.log('------------------------------------------');
					console.log('Mensaje recibido: %s', mensaje);
					console.log('------------------------------------------');
				}, {noAck: false})
					.catch( function(err){
						console.error('[Publicaciones_server]: Error al consumir mensajes: ' + err);
					});	
			})
			.catch(function(err){
				console.error('[Publicaciones_server]: Error createChannel: '+ err);
			});
	})
	.catch(function (err){
		console.error('[Publicaciones_server]: Error connect: ' + err);
	});




