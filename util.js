const { exec } = require('child_process');
var _ = require('underscore');

var Util = function (){

	//Metodo para ejecutar procesos hijos 
	function ejecutarProceso(cmd){
		exec(cmd, { shell: true}, (err, stdout) => {
			if (err){
				console.error(`exec error: ${err}`);
			}else{
				console.log(`stdout: ${stdout}`);
			}
		});
	}

	//
	function startServers(modo) {
		startServer('envios_server', modo);
		startServer('infracciones_server', modo);
		startServer('pagos_server', modo);
		startServer('publicaciones_server', modo);
		startServer('compras_server', modo);
		startServer('web_server', modo);
	}

	function execSimulacion(){
		startServer('envios_server');
		startServer('infracciones_server');
		startServer('pagos_server');
		startServer('publicaciones_server');
		startServer('compras_server');
		ejecutarProceso('start cmd /K "cd ../web_server/ && node simulacion.js');
	}

	function startServer(server, modo){
		var comando = 'start cmd /K "cd ../' + server + '/ && node ' + server + ' ' + (modo || '')  + '"';
		ejecutarProceso(comando);
	}

	function getProximosEventos(eventos){
		var result = '';
		_.forEach(eventos, (item) => {
			result = result + item.evento + ', ';
		});
		if ( result.length > 1 ) {
			result = result.slice(0, -2);
		}else{
			result = 'Sin eventos pendientes';
		}
		return result;
	}

	function validarInput(arg){
		var key_words = ['compras', 'web', 'infracciones', 'pagos', 'publicaciones', 'envios',
			'resultado_infraccion', 'conInfraccion', 'sinInfraccion', 
			'forma_entrega', 'correo', 'retira',
			'medio_pago', 'efectivo', 'tarjeta',
			'confirmacion','aceptada', 'cancelada'];
		
		return key_words.includes(arg);					
	}

	function actualizarReloj(clock1, clock2){
		clock1.forEach((valor, index) => {
			if (clock2[index] > valor){
				clock1[index] = clock2[index];
			}
		});
	}

	return {
		startServers : startServers,
		startServer : startServer,
		execSimulacion : execSimulacion,
		getProximosEventos : getProximosEventos,
		validarInput : validarInput,
		actualizarReloj : actualizarReloj,
		formatearMsg : function (msg){
			var cadena = '--------------------------\\n';
			cadena = cadena + msg;
			cadena = cadena + '\\n--------------------------\\n';

			return cadena;
		}
	};
}();

module.exports = Util;