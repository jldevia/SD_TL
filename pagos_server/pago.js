const EventEmitter = require('events').EventEmitter;
var sleep = require('sleep');

class Pago extends EventEmitter{
	constructor(refServer, id, data){
		super();
		
		this.estado = new Object();
		this.server = refServer;
		this.pago_id = id;
		this.data = data;
		this.data.pago_id = id;

		this.eventosPendientes = new Array();
		
		//Eventos externos
		this.on('autorizarPago', (data) => this.resolverAutorizacion(data));

		//Eventos internos
		//this.on('pagoIniciado', (data) => this.resolverAutorizacion(data));
		this.on('autorizacionResuelta', (data) => this.informarResultado(data));
		this.on('resultadoInformado', (data) => this.finalizarPago(data));
	}

	// iniciarPago(data){

	// 	//Estado actual: INICIANDO_PAGO
	// 	this.estado.nombre = 'INICIANDO_PAGO';
	// 	this.estado.timestamp = new Date();
	// 	this.estado.transicion_in = 'autorizarPago';
	// 	this.estado.transicion_out = ['pagoIniciado'];

	// 	//Se actualiza data
	// 	this.data = data;
	// 	this.data.pago_id = this.pago_id;
	// 	this.data.medio_pago = data.medio_pago;

	// 	//sleep.sleep(2);

	// 	//se registra el evento disparado en el historial de eventos "sucedidos"
	// 	this.historial_eventos.push(this.estado.transicion_in);
	// }

	resolverAutorizacion(data){
		//Estado actual: RESOLVIENDO_AUTORIZACION
		this.estado.nombre = 'RESOLVIENDO_AUTORIZACION';
		this.estado.timestamp = new Date();
		this.estado.transicion_in = 'pagoIniciado';
		this.estado.transicion_out = ['autorizacionResuelta'];

		//Se resuleve autorizacion de pago y se actualiza data
		var rechazado = 'F';
		if (this.data.medio_pago != 'efectivo'){
			if (!data.pago_rechazado){
				rechazado = Math.random() > 0.3 ? 'F' : 'V';
			}else{
				rechazado = data.pago_rechazado;
			}
		}
		this.data.pago_rechazado = rechazado;
	}

	informarResultado(data){
		//Estado actual: INFORMANDO_RESULTADO
		this.estado.nombre = 'INFORMANDO_RESULTADO';
		this.estado.timestamp = new Date();
		this.estado.transicion_in = 'autorizacionResuelta';
		this.estado.transicion_out = ['resultadoInformado'];

		//Se envia mensaje de resultado a los servidores de "Compras" y "Publicaciones"
		var topico = '.publicaciones.compras.';
		var msg = new Object();
		msg.evento = 'autorizacionPago';
		msg.data = this.data;
		this.server.publicarMensaje(topico, msg);

		//sleep.sleep(2);
		this.emit(this.estado.transicion_out[0]);

	}

	finalizarPago(data){
		//Estado actual: PAGO_RESUELTO_INFORMADO
		this.estado.nombre = 'PAGO_RESUELTO_INFORMADO';
		this.estado.timestamp = new Date();
		this.estado.transicion_in = 'resultadoInformado';
		this.estado.transicion_out = [];

	}
}

module.exports = Pago;