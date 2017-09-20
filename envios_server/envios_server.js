var amqp = require  ('amqplib');
var Shipment = require('./models/envio');
const EventEmitter = require('events').EventEmitter;

class ServidorEnvios extends EventEmitter{
	constructor(){
		super();

		this.prox_num_envio = 1;

		//Se registran eventos del servidor
		this.on('calcularCostoEnvio', (data) => this.calcularCostoEnvio(data));
		this.on('agendarEnvio', (data) => this.agendarEnvio(data));
	}

	calcularCostoEnvio(data){
		//Costo calculado aleatoriamente entre $1 y $500
		var costo = Math.random() * (500 - 1) + 1;
		
		var topico = '.compras.';
		var mensaje = new Object();
		mensaje.evento = 'costoEnvioCalculado';
		mensaje.data = {
			num_compra : data.num_compra,
			costo: costo
		};
		this.publicarMensaje(topico, JSON.stringify(mensaje));
	}

	agendarEnvio(data){
		var new_shipment = new Shipment();
		new_shipment.numero = this.prox_num_envio;
		new_shipment.num_compra = data.num_compra;
		new_shipment.costo = data.costo;
		new_shipment.fecha_envio = this.sumarDias(new Date, 5);

		new_shipment.save(function(err){
			if (err){
				console.error('[Envios_server]: Error al agendar envio: ' + err);
			}else{
				console.log('[Envios_server]: Envio agendado: ' + new_shipment);
			}
		});

		this.solicitarEnvioProducto(data);
	}

	solicitarEnvioProducto(data){
		var topico = '.publicaciones.';
		var mensaje = new Object();
		mensaje.evento = 'enviarProducto';
		mensaje.data = {
			publicacion_id : data.publicacion_id,
			cantidad : data.cantidad
		};

		this.publicarMensaje(topico, JSON.stringify(mensaje));
	}

	sumarDias(fecha, dias){
		fecha.setDate(fecha.getDate() + dias);
		return fecha;
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
						console.error('[Envios_server]: Error Creando canal: ' + err);
					});
			})
			.catch( function(err){
				console.error('[Envios_server]: Error conectando a servidor de mensajeria: ' + err);
			});
	}
}

var server = new ServidorEnvios();

console.log('[Envios_server] en ejecución....');
console.log('Esperando mensajes...');
amqp.connect('amqp://localhost')
	.then(function(con){
		con.createChannel()
			.then(function(chn){
				var queue = 'envios_server';
				chn.assertQueue(queue, {durable : true});
				chn.consume(queue, (msg) => {
					var mensaje = JSON.parse(msg.content.toString());
					server.emit(mensaje.evento, mensaje.data);
					console.log('------------------------------------------');
					console.log('Mensaje recibido: %s', JSON.stringify(mensaje));
					console.log('------------------------------------------');
				}, {noAck: false})
					.catch( function(err){
						console.error('[Envios_server]: Error al consumir mensajes: ' + err);
					});	
			})
			.catch(function(err){
				console.error('[Envios_server]: Error createChannel: '+ err);
			});
	})
	.catch(function (err){
		console.error('[Envios_server]: Error connect: ' + err);
	});
