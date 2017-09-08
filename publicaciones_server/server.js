'use strict';

var amqp = require  ('amqplib');
var publicaciones = require('./service/publicacionesServices');

amqp.connect('amqp://localhost')
	.then(function(conn){
		conn.createChannel()
			.then(function(chn){
				var queue_server = 'q_publicaciones';
				
				chn.assertQueue(queue_server, {durable: false});
				chn.prefetch(1);

				console.log('[Server_publicaciones] - Esperando solicitud....');
				chn.consume(queue_server, handleMsg)
					.then(function(msg){
						console.log('Mensaje recibido');
					})
					.catch(function(err){
						console.error('[Server_publicaciones] - Error al consumir mensaje: ' + err);
					});
				
				function handleMsg(msg){
					var request = JSON.parse(msg.content);
					var reply;

					console.log('Solicitud recibida: ' + request);

					reply = publicaciones.service.handle(request);
				
					if (msg != null) {
						chn.sendToQueue(msg.properties.replyTo,
							new Buffer(reply), 
							{correlationId: msg.properties.correlationId, contentType : 'application/json'});
						chn.ack(msg);
					}

				}	
			})
			.catch(function(err){
				console.error('[Server_publicaciones] - Error al crear canal: ' + err);
			});
	})	
	.catch(function(err){
		console.error('[Server_publicaciones] - Error al establecer conexión con el servidor de mensajería: ' + err);
	});