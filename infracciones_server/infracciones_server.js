var amqp = require  ('amqplib');
const EventEmitter = require('events').EventEmitter;

class ServidorInfracciones extends EventEmitter{
	constructor () {
		super();

		//Se registran eventos del servidor
		this.on('compraGenerada', (data) => this.procesarCompraGenerada(data));

	}

	procesarCompraGenerada(data){
		var resultado = Math.random() > 0.7 ? 'conInfraccion' : 'sinInfraccion';
		var topico = '.publicaciones.compras.';
		var mensaje = new Object();
		mensaje.evento = 'resultadoInfraccion';
		mensaje.data = {
			publicacion_id : data.publicacion_id,
			num_compra : data.num_compra,
			cantidad : data.cantidad,
			resultado : resultado,
			motivo : ''
		};
		
		this.publicarMensaje(topico, JSON.stringify(mensaje));
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
						console.error('[Infracciones_server]: Error Creando canal: ' + err);
					});
			})
			.catch( function(err){
				console.error('[Infracciones_server]: Error conectando a servidor de mensajeria: ' + err);
			});
	}
}

var server = new ServidorInfracciones();

console.log('[Infracciones_server] en ejecución....');
console.log('Esperando mensajes...');
amqp.connect('amqp://localhost')
	.then(function(con){
		con.createChannel()
			.then(function(chn){
				var queue = 'infracciones_server';
				chn.assertQueue(queue, {durable : true});
				chn.consume(queue, (msg) => {
					var mensaje = JSON.parse(msg.content.toString());
					server.emit(mensaje.evento, mensaje.data);
					console.log('------------------------------------------');
					console.log('Mensaje recibido: %s', mensaje);
					console.log('------------------------------------------');
				}, {noAck: false})
					.catch( function(err){
						console.error('[Infracciones_server]: Error al consumir mensajes: ' + err);
					});	
			})
			.catch(function(err){
				console.error('[Infracciones_server]: Error createChannel: '+ err);
			});
	})
	.catch(function (err){
		console.error('[Infracciones_server]: Error connect: ' + err);
	});





