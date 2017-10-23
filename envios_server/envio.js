const EventEmitter = require('events').EventEmitter;
var sleep = require('sleep');

// Clase que simula el procesamiento de un envio para una compra
class Envio extends EventEmitter{
	constructor(refServer, id, data){
		super();

		this.estado = new Object();
		this.server = refServer;
		this.envio_id = id;
		this.data = data;
		this.data.envio_id = id; 

		this.eventosPendientes = new Array();

		this.historial_eventos = new Array();

		//Eventos externos
		this.on('calcularCostoEnvio', (data) => this.calcularCosto(data));
		this.on('agendarEnvio', (data) => this.agendarEnvio(data));

		//Eventos internos
		//this.on('envioIniciado', (data) => this.calcularCosto(data));
		this.on('costoCalculado', (data) => this.informarCosto(data));
		this.on('resultadoInformado', (data) => this.esperar(data));
		this.on('envioAgendado', (data) => this.finalizarEnvio(data));
	}

	/* iniciarEnvio(data){
		//Estado actual: INICIANDO_ENVIO
		this.estado.nombre = 'INICIANDO_ENVIO';
		this.estado.timestamp = new Date();
		this.estado.transicion_in = 'calcularCostoEnvio';
		this.estado.transicion_out = ['envioIniciado'];

		//sleep.sleep(2);

		//se registra el evento disparado en el historial de eventos "sucedidos"
		this.historial_eventos.push(this.estado.transicion_in);
	} */

	calcularCosto(data){
		//Estado actual: CALCULANDO_COSTO
		this.estado.nombre = 'CALCULANDO_COSTO';
		this.estado.timestamp = new Date();
		this.estado.transicion_in = 'envioIniciado';
		this.estado.transicion_out = ['costoCalculado'];

		//Costo calculado aleatoriamente entre $1 y $500
		var costo = Math.random() * (500 - 1) + 1;
		this.data.costo_envio = costo.toFixed(2);

		//sleep.sleep(2);
		
		//se registra el evento disparado en el historial de eventos "sucedidos"
		this.historial_eventos.push(this.estado.transicion_in);
	}

	informarCosto(data){
		//Estado actual: INFORMANDO_RESULTADO
		this.estado.nombre = 'INFORMANDO_RESULTADO';
		this.estado.timestamp = new Date();
		this.estado.transicion_in = 'costoCalculado';
		this.estado.transicion_out = ['resultadoInformado'];

		//Se informa resultado
		var topico = '.compras.';
		var msg = new Object();
		msg.evento = 'costoEnvioCalculado';
		msg.data = this.data;
		this.server.publicarMensaje(topico, JSON.stringify(msg));

		//se registra el evento disparado en el historial de eventos "sucedidos"
		this.historial_eventos.push(this.estado.transicion_in);
	}

	esperar(data){
		//Estado actual: ESPERANDO
		this.estado.nombre = 'ESPERANDO';
		this.estado.timestamp = new Date();
		this.estado.transicion_in = 'resultadoInformado';
		this.estado.transicion_out = []; //No se especifica evento, el proximo evento que dispara la transicion de estado
		//es externo.
	}

	agendarEnvio(data){
		//Estado actual: AGENDANDO_ENVIO
		this.estado.nombre = 'AGENDANDO_ENVIO';
		this.estado.timestamp = new Date();
		this.estado.transicion_in = 'agendarEnvio';
		this.estado.transicion_out = ['envioAgendado'];
		
		//Acutalizo data del envio
		this.data = data;
		this.data.fecha_envio = this.sumarDias(new Date, 7);

		//Se solicita "envio del producto" a "Publicaciones"
		var topico = '.publicaciones.';
		var msg = new Object();
		msg.evento = 'enviarProducto';
		msg.data = this.data;
		this.server.publicarMensaje(topico, JSON.stringify(msg));
		
		//sleep.sleep(2);
		this.emit(this.estado.transicion_out[0]);

		//se registra el evento disparado en el historial de eventos "sucedidos"
		this.historial_eventos.push(this.estado.transicion_in);
	}

	finalizarEnvio(data){
		//Estado actual: ENVIO_FINALIZADO
		this.estado.nombre = 'ENVIO_FINALIZADO';
		this.estado.timestamp = new Date();
		this.estado.transicion_in = 'envioAgendado';
		this.estado.transicion_out = [];

		sleep.sleep(2);

		//se registra el evento disparado en el historial de eventos "sucedidos"
		this.historial_eventos.push(this.estado.transicion_in);
	}
	
	//funcion privada
	sumarDias(fecha, dias){
		fecha.setDate(fecha.getDate() + dias);
		return fecha;
	}
}

module.exports = Envio;