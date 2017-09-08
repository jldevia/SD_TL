'use strict';

var amqp = require('amqplib');

amqp.connect('amqp://localhost')
	.then(function(conn){
		conn.createChannel()
			.then(function(chn){
				chn.assertQueue('', {exclusive: true})
					.then(function(q){
						var id = generateUuid();
						var solicitud = {
							accion : "lista_acciones"
						};
						
						console.log('Nombre aleatorio de cola: ' + q.queue);
						
						chn.consume(q.queue, handleMsg, {noAck : true})
							.then(function(msg){
								console.log('Mensaje recibido');
							})
							.catch(function(err){
								console.error('[Algun_cliente] - Error al consumir mensaje: '+err);		
							});
						

						chn.sendToQueue('q_publicaciones',
							new Buffer(JSON.stringify(solicitud)),
							{ correlationId: id, replyTo: q.queue, contentType : 'application/json' });
							
						function handleMsg(msg) {
							if (msg.properties.correlationId == id) {
								console.log('[Algun_cliente] - Respuesta del servidor: ' + msg.content);
								setTimeout(function() { conn.close(); process.exit(0); }, 500);
							}
						}	

					})
					.catch(function(err){
						console.error('[Algun_cliente] - Error al confirmar cola: '+err);
					});
			})
			.catch(function(err){
				console.error('[Algun_cliente] - Error al crear canal: '+err);
			});
	})
	.catch(function(err){
		console.error('[Algun_cliente] - Error al establecer conexión con el servidor de mensajería: ' + err);
	});

function generateUuid() {
	return Math.random().toString() +
		Math.random().toString() +
		Math.random().toString();
}	