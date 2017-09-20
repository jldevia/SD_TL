var amqp = require  ('amqplib');
const EventEmitter = require('events').EventEmitter;

class ServidorPagos extends EventEmitter {
	constructor(){
		super();
		
		this.prox_num_pago = 1;

		//Se registran eventos del servidor
		this.on('autorizarPago', (data) => this.procesarPago(data));
	}

	procesarPago(data){
		var rechazado = Math.random() > 0.3 ? 'F' : 'V';
		var topico = '.compras.publicaciones.';
		var mensaje = new Object();
		mensaje.evento = 'autorizacionPago';
		mensaje.data = {
			num_compra : data.num_compra,
			numero_pago : this.prox_num_pago,
			publicacion_id : data.publicacion_id,
			cantidad : data.cantidad,
			rechazado : rechazado,
			motivo : ''
		};

		this.publicarMensaje(topico, JSON.stringify(mensaje));

		this.prox_num_pago++;
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
						console.error('[Pagos_server]: Error Creando canal: ' + err);
					});
			})
			.catch( function(err){
				console.error('[Pagos_server]: Error conectando a servidor de mensajeria: ' + err);
			});
	}	
	
}

var server = new ServidorPagos();

console.log('[Pagos_server] en ejecución....');
console.log('Esperando mensajes...');
amqp.connect('amqp://localhost')
	.then(function(con){
		con.createChannel()
			.then(function(chn){
				var queue = 'pagos_server';
				chn.assertQueue(queue, {durable : true});
				chn.consume(queue, (msg) => {
					var mensaje = JSON.parse(msg.content.toString());
					server.emit(mensaje.evento, mensaje.data);
					console.log('------------------------------------------');
					console.log('Mensaje recibido: %s', mensaje);
					console.log('------------------------------------------');
				}, {noAck: false})
					.catch( function(err){
						console.error('[Pagos_server]: Error al consumir mensajes: ' + err);
					});	
			})
			.catch(function(err){
				console.error('[Pagos_server]: Error createChannel: '+ err);
			});
	})
	.catch(function (err){
		console.error('[Pagos_server]: Error connect: ' + err);
	});

