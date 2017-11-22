
var _ = require('underscore');
var sleep = require('sleep');
var servidorWeb = require('./web_server').server;
var config = require('../config.json');

'use strict';

//Devuelve un Id. de usuario entre 1 y 51
function getIdUsuario (){
	return Math.round(Math.random() * 50) + 1;
}

//Devuelve un Id. de usuario entre 1 y 21
function getIdPublicacion(){
	return Math.round(Math.random() * 20) + 1;
}

//Devuelve una cantidad aleatoria entre 1 y 101
function getCantidad(){
	return Math.round(Math.random() * 100) + 1;
}

var usuario_id;
var publicacion_id;
var cantidad;
//Cantidad de compras simuladas. Por defecto 10.
var cant_compras = config.simulacion.cantidad? config.simulacion.cantidad: 10;

for (var i = 1; i <= cant_compras; i++){
	usuario_id = getIdUsuario();
	var sesion = servidorWeb.getSesionByUser(usuario_id);

	//Si el usuario ya tiene iniciada una sesión se intenta con otro usuario
	if(sesion){
		//usuario_id = getIdUsuario();
		continue;
	}
	
	servidorWeb.emit('nuevaSesion', usuario_id);
	
	publicacion_id = getIdPublicacion();
	cantidad = getCantidad();
	servidorWeb.emit('iniciaCompra', usuario_id, {publicacion_id : publicacion_id, cantidad : cantidad});

	if ( i % 2 === 0 ) {
		//sleep.sleep(13);
		setTimeout(function(){
			console.log('Esperando ...');
		}, 15000);
	}	
}


// _.forEach(doc.compras, (item, index) =>{
	
// 	servidorWeb.emit('nuevaSesion', item.usuario_id);
// 	servidorWeb.emit('iniciaCompra', item.usuario_id, {publicacion_id : item.publicacion_id, cantidad : item.cantidad});

// 	if ( (index + 1) % 2 === 0 ) {
// 		//sleep.sleep(15);
// 		setTimeout(function(){
// 			console.log('Esperando ...');
// 		}, 60000);
// 	}
// });
