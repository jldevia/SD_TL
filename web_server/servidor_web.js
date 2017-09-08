var SesionWeb = require('./sesion_web');
var amqp = require('amqplib');
var _ = require('underscore');

'use strict';

class ServidorWeb extends {
	constructor(){
		super();

		this.sesiones = [];
	}

	consumirMensaje (){
		amqp.connect('amqp://localhost')
				.then(function(con){
					con.createChannel()
						.then(function(chn){
							var queue = 'web_server';
							chn.assertQueue(queue, {durable : true});
							chn.consume(queue)
								.then(function(msg){
									var mensaje = JSON.parse(msg.content.toString());
									
								})
								.catch(function(err){

								});	
						})
						.catch();
				})
				.catch(function (err){

				});
	}

}