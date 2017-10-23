var servidorWeb = require('./web_server').server;
var sleep = require('sleep');

'use strict';

//Se crean sesiones
servidorWeb.emit('nuevaSesion', 5); //sesion 1 de usuario 5
servidorWeb.emit('nuevaSesion', 2);//sesion 2
servidorWeb.emit('nuevaSesion', 10);//sesion 3
// server.emit('nuevaSesion', 1);//sesion 4
// server.emit('nuevaSesion', 10);//sesion 5
// server.emit('nuevaSesion', 8);//sesion 6

//var sesion1 = servidorWeb.getSesionByUser(5);
// var sesion2 = server.getSesionByUser(25);
// var sesion3 = server.getSesionByUser(12);
// var sesion4 = server.getSesionByUser(1);
// var sesion5 = server.getSesionByUser(10);
// var sesion6 = server.getSesionByUser(8);

//se inician compras
servidorWeb.emit('iniciaCompra', 5, {publicacion_id : 1, cantidad: 1}); //Compra del producto 1 (publicacion 1), cantidad: 1
servidorWeb.emit('iniciaCompra', 2, {publicacion_id : 2, cantidad: 2}); //Compra del producto 2 (publicacion 2), cantidad: 2
// sleep.sleep(10);
servidorWeb.emit('iniciaCompra', 10,{publicacion_id : 3, cantidad: 10}); //Compra del producto 3 (publicacion 3), cantidad: 1
// sesion4.emit('iniciarCompra', {publicacion_id : 4, cantidad: 1}); //Compra del producto 4 (publicacion 4), cantidad: 1
// sleep.sleep(10);
// sesion5.emit('iniciarCompra', {publicacion_id : 10, cantidad: 2}); //Compra del producto 10 (publicacion 10), cantidad: 2
// sesion6.emit('iniciarCompra', {publicacion_id : 6, cantidad: 3}); //Compra del producto 6 (publicacion 6), cantidad: 3
//

