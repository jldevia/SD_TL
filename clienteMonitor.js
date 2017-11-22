console.log('Conectando con monitor...');

var socket = require('socket.io-client')('http://localhost:17850');

var util = require('./util');

socket.on('listadoCompras', function(data){
	console.log('**********************');
	console.log('Servidor: ' + data.origen);
	console.log('Listado Compras: ' + data.listado_compras);
	console.log('**********************');
});

socket.on('estadoCompra', function(data){
	console.log('**********************');
	console.log('Servidor: ' + data.origen);
	console.log('N° Compra: ' + data.num_compra);
	console.log('Estado: ' + data.estado);
	console.log('Prox. Evento: ' + data.prox_eventos);
	console.log('Datos: ' + JSON.stringify(data.data));
	console.log('Reloj: ' + data.reloj );
	console.log('**********************');
});

socket.on('dashboard', function(data){
	console.log('******* DASHBOARD ********');
	console.log('Cant. Compras: ' + data.cant_compras);
	console.log('Cant. Compras Canceladas: ' + data.cant_compras_canceladas);
	console.log('Cant. Compras Rechazadas (por infraccion): ' + data.cant_compras_rechazadas);
	console.log('Cant. Pagos Rechazados: ' + data.cant_pagos_rechazados);
	console.log('Cant. Compras Concretadas: ' + data.cant_compras_concretadas);
	console.log('***************************');
});

//Se inicializan los servidores en el modo correspondiente
var modo_ini = process.argv[2] || 'XXXX'; 

switch (modo_ini) {
case 'AUT':{
	socket.emit('ejecutarSimulacionAUT');
	console.log('Ejecutando simulacion automática...');
	mostrar_menu = false;
	break;}
case 'PAP':{
	socket.emit('ejecutarSimulacionPAP');
	console.log('Monitor en ejecución en modo PAP');
	break;}
default:{
	console.log('Modo de inicio desconocido!!!');
	process.exit(1);
}
}

function imprimirMenu(){
	if (modo_ini === 'PAP'){
		console.log('******************************************************');
		console.log('Menu:');
		console.log('1: Nueva compra <usuario_id, publicacion_id, cantidad>');
		console.log('2: Obtener Compras <server>');
		console.log('3: Estado Compra <server, num_compra>');
		console.log('4: Avanzar <server, num_compra, data>');
		console.log('5: Bajar Servidor <server>');
		console.log('6: Solicitar corte <server>');
		console.log('7: Salir');
		console.log('******************************************************');
	}
}

process.stdin.resume();
process.stdin.setEncoding('utf8');

imprimirMenu();

process.stdin.on('data', (res) => {
	if (modo_ini !== 'PAP'){
		return;
	}

	var cmd = res.trim().split(' ');
	var opc = cmd[0];
	//console.log('Respuesta: ' + opc);
	var data;
	var arg1, arg2, arg3;
	switch(opc){
	case '1':
		arg1 = cmd[1]? cmd[1].trim(): '';
		arg2 = cmd[2]? cmd[2].trim(): '';
		arg3 = cmd[3]? cmd[3].trim(): '';
		data = {
			usuario_id : arg1,
			publicacion_id : arg2,
			cantidad : arg3
		};
		//console.log('Solicitando nueva compra: ' + JSON.stringify(data));
		socket.emit('nuevaCompra', data);
		break;
	case '2':
		arg1 = cmd[1]? cmd[1].trim(): '';
		if (!util.validarInput(arg1)){
			console.log('Error: Argumento "'+ arg1 +'" inválido');
			break;
		}
		data = {
			server_name : arg1
		};
		socket.emit('getCompras', data);
		break;
	case '3':
		arg1 = cmd[1]? cmd[1].trim(): '';
		arg2 = cmd[2]? cmd[2].trim(): '';
		if ( !util.validarInput(arg1) ){
			console.log('Error: Argumento "'+ arg1 +'" inválido');
			break;
		}
		data = {
			server_name : arg1,
			num_compra : arg2 
		};
		socket.emit('getEstado', data);
		break;
	case '4':
		arg1 = cmd[1]? cmd[1].trim(): '' ;
		arg2 = cmd[2]? cmd[2].trim() : '';
		arg3 = cmd[3]? cmd[3].trim(): '';
		if (cmd.length == 3 || cmd.length == 4){
			data = '{"server_name": "'+ arg1
				+'", "num_compra": "'+ arg2 +'"';
			if(arg3){
				var atr = arg3.split('=');
				var key = atr[0].trim();
				var value = atr[1].trim();
				
				if ( !util.validarInput(key) ) {
					console.log('Error: Argumento "'+ key +'" inválido');
					break;
				}

				if ( !util.validarInput(value) ) {
					console.log('Error: Argumento "'+ value +'" inválido');
					break;
				}

				data = data + ', "arg": {"'+ key + '": "' + value +'"}';
			}
			data = data + '}';
			//console.log('Avanzar: ' + data);		
			socket.emit('avanzar', JSON.parse(data));
		}else{
			console.log('Cantidad de parametros incorrecta: 4 (Avanzar) <server, num_compra, data>');
		} 
		break;
	case '5':
		arg1 = cmd[1]?cmd[1].trim(): '';
		data = {
			server_name : arg1
		};
		socket.emit('bajaServidor', data);
		break;
	case '6':
		arg1 = cmd[1]?cmd[1].trim(): '';
		data = {
			server_name : arg1
		};
		socket.emit('iniciarCorte', data);
		break;
	case '7':
		console.log('Finalizando sesion del cliente del monitor');
		process.exit(0);
		break;
	default:
		console.log('La opcion seleccionada no existe.');
	}
	//process.stdin.pause();
	imprimirMenu();
});
