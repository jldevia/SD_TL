const EventEmitter = require('events').EventEmitter;
var sleep = require('sleep');

'use strict';

//Clase que simula el procesamiento de una solicitud al servidor "Compras"
//Tal vez seria mejor llamarlo "SolicitudCompras"
class Compra extends EventEmitter {
	constructor(refServer, data){
		super();

		this.estado = new Object;
		this.server = refServer;
		this.num_compra = data.num_compra;
		this.data = data;
		this.orden_evento = 0;

		this.eventosPendientes = new Array();
		this.historial_eventos = new Array();

		//Eventos externos
		this.on('nuevaCompra', (data) => this.informarCompraGenerada(data));
		this.on('resultadoInfraccion', (data) => this.procesarResultadoInfraccion(data));
		this.on('entregaSeleccionada', (data) => this.procesarEntregaSeleccionada(data));
		this.on('costoEnvioCalculado', (data) => this.procesarCostoEnvio(data));
		this.on('pagoSeleccionado', (data) => this.procesarPagoSeleccionado(data));
		this.on('confirmacionCompra', (data) => this.procesarConfirmacionCompra(data));
		this.on('autorizacionPago', (data) => this.procesarAutorizacionPago(data) );

		//Eventos internos
		//this.on('nuevaCompraIniciada', (data) => this.informarCompraGenerada(data));
		this.on('seleccionEntregaProcesada', (data) => this.solicitarCostoEnvio(data));
		this.on('importeCompraCalculado', (data) => this.informarImporteCompra(data));
		this.on('confirmarCompra', (data) => this.solicitarConfirmacionCompra(data));
		this.on('compraCancelada', () => this.cancelarCompra()); //Evento emitido internamente en esta clase
		this.on('autorizarPago', (data) => this.solicitarAutorizacionPago(data));
		this.on('compraConInfraccion', () => this.infomarCompraRechazada());
		this.on('pagoRechazado', () => this.informarPagoRechazado());
		this.on('agendarEnvio', () => this.solicitarAgendarEnvio());		
		this.on('compraConcretada', (origen) => this.informarCompraConcretada(origen));
	}

	// iniciarNuevaCompra(data){
	// 	//Estado actual: INICIANDO_COMPRA
	// 	this.estado.nombre = 'INICIANDO_COMPRA';
	// 	this.estado.timestamp = new Date();
	// 	this.estado.transicion_in = 'nuevaCompra';
	// 	this.estado.transicion_out = ['nuevaCompraIniciada'];
	// 	this.logEstado();

	// 	//Se actualiza data
	// 	this.data = data;
	// 	//this.data.num_compra = data.num_compra;
		
	// 	sleep.sleep(2);
		
	// 	this.historial_eventos.push({
	// 		orden: this.orden_evento++,
	// 		evento: this.estado.transicion_in
	// 	});
		
	// }

	informarCompraGenerada(data){
		//Estado actual: INFORMANDO_COMPRA_GENERADA
		this.estado.nombre = 'INFORMANDO_COMPRA_GENERADA';
		this.estado.timestamp = new Date();
		this.estado.transicion_in = 'nuevaCompraIniciada';
		this.estado.transicion_out = [];
		this.logEstado();
		
		var topico = '.infracciones.web.publicaciones.';
		var mensaje = new Object();
		mensaje.evento = 'compraGenerada';
		mensaje.data = this.data;

		this.server.publicarMensaje(topico, JSON.stringify(mensaje));

		this.historial_eventos.push({
			orden: this.orden_evento++,
			evento: this.estado.transicion_in
		});
		
	}

	procesarEntregaSeleccionada(data){
		//Estado actual: PROCESANDO_SELECCION_ENTREGA
		this.estado.nombre = 'PROCESANDO_SELECCION_ENTREGA';
		this.estado.timestamp = new Date();
		this.estado.transicion_in = 'entregaSeleccionada';
		this.estado.transicion_out = ['seleccionEntregaProcesada'];
		this.logEstado();

		//Actualizando data
		this.data.forma_entrega = data.forma_entrega;
		
		this.historial_eventos.push({
			orden: this.orden_evento++,
			evento: this.estado.transicion_in
		});		
	}

	procesarResultadoInfraccion(data){
		//Estado actual: PROCESANDO_RESULTADO_INFRACCION
		this.estado.nombre = 'PROCESANDO_RESULTADO_INFRACCION';
		this.estado.timestamp = new Date();
		this.estado.transicion_in = 'resultadoInfraccion';
		this.estado.transicion_out = [];
		this.logEstado();

		//Se actualiza data
		this.data.resultado_infraccion = data.resultado_infraccion;
		
		sleep.sleep(2);

		this.historial_eventos.push({
			orden: this.orden_evento++,
			evento: this.estado.transicion_in
		});
	}

	solicitarCostoEnvio(data){
		//Estado actual: SOLICITANDO_COSTO_ENVIO
		this.estado.nombre = 'SOLICITANDO_COSTO_ENVIO';
		this.estado.timestamp = new Date();
		this.estado.transicion_in = 'seleccionEntregaProcesada';
		this.estado.transicion_out = [];

		if (this.data.forma_entrega === 'correo'){
			var mensaje = new Object();
			var topico = '.envios.';
			mensaje.evento = 'calcularCostoEnvio';
			mensaje.data = this.data;
			this.server.publicarMensaje(topico, JSON.stringify(mensaje));
		}else{
			//Si la forma de entrega no es por correo (retiro en persona)
			//se simula el evento externo "costoEnvioCalculado" para continuar con el procesamiento de la compra
			this.data.costo_envio = 0;
			this.estado.transicion_out = ['costoEnvioCalculado'];
		}
		this.logEstado();

		this.historial_eventos.push({
			orden: this.orden_evento++,
			evento: this.estado.transicion_in
		});

	}

	procesarCostoEnvio(data){
		//Estado actual: PROCESANDO_COSTO_ENVIO
		this.estado.nombre = 'PROCESANDO_COSTO_ENVIO';
		this.estado.timestamp = new Date();
		this.estado.transicion_in = 'costoEnvioCalculado';
		this.estado.transicion_out = ['importeCompraCalculado'];
		this.logEstado();
		
		//Actualizando data
		var subTotal = Math.random() * 1000;
		var importeTotal = subTotal + Number(data.costo_envio);
		this.data.sub_total = subTotal.toFixed(2);
		this.data.costo_envio = data.costo_envio;
		this.data.importe_total = importeTotal.toFixed(2);

		sleep.sleep(2);

		this.historial_eventos.push({
			orden: this.orden_evento++,
			evento: this.estado.transicion_in
		});
	}

	informarImporteCompra(data){
		//Estado actual: INFORMANDO_IMPORTE_COMPRA
		this.estado.nombre = 'INFORMANDO_IMPORTE_COMPRA';
		this.estado.timestamp = new Date();
		this.estado.transicion_in = 'importeCompraCalculado';
		this.estado.transicion_out = [];
		this.logEstado();
				
		var topico = '.web.';
		var mensaje = new Object();
		mensaje.evento = 'importeCompraCalculado';
		mensaje.data = this.data;
		this.server.publicarMensaje(topico, JSON.stringify(mensaje));
		
		this.historial_eventos.push({
			orden: this.orden_evento++,
			evento: this.estado.transicion_in
		});
	}

	procesarPagoSeleccionado(data){
		//Estado actual: PROCESANDO_PAGO_SELECCIONADO
		this.estado.nombre = 'PROCESANDO_PAGO_SELECCIONADO';
		this.estado.timestamp = new Date();
		this.estado.transicion_in = 'pagoSeleccionado';
		this.estado.transicion_out = ['confirmarCompra'];
		this.logEstado();

		this.data.medio_pago = data.medio_pago;
		
		this.pagoSeleccionado = true;

		//sleep.sleep(2);
		
		this.historial_eventos.push({
			orden: this.orden_evento++,
			evento: this.estado.transicion_in
		});
	}

	solicitarConfirmacionCompra(data){
		//Estado actual: SOLICITANDO_CONFIRMACION_COMPRA
		this.estado.nombre = 'SOLICITANDO_CONFIRMACION_COMPRA';
		this.estado.timestamp = new Date();
		this.estado.transicion_in = 'confirmarCompra';
		this.estado.transicion_out = [];
		this.logEstado();

		var topico = '.web.';
		var mensaje = new Object();
		mensaje.evento = 'confirmarCompra';
		mensaje.data = this.data;
		this.server.publicarMensaje(topico, JSON.stringify(mensaje));
		
		this.historial_eventos.push({
			orden: this.orden_evento++,
			evento: this.estado.transicion_in
		});
	
		sleep.sleep(1);
	}

	procesarConfirmacionCompra(data){
		//Se actualiza data
		this.data.confirmacion = data.confirmacion;
		
		//Estado actual: PROCESANDO_CONFIRMACION_COMPRA
		this.estado.nombre = 'PROCESANDO_CONFIRMACION_COMPRA';
		this.estado.timestamp = new Date();
		this.estado.transicion_in = 'confirmacionCompra';

		if (this.data.confirmacion ==='aceptada') {
			this.estado.transicion_out = ['autorizarPago'];	
		}else if (this.data.confirmacion === 'cancelada') {
			this.emit('compraCancelada');	
		}

		this.logEstado();

		sleep.sleep(2);

		this.historial_eventos.push({
			orden: this.orden_evento++,
			evento: this.estado.transicion_in
		});
	}

	cancelarCompra(data){
		//Estado actual: CANCELADA_POR_USUARIO
		this.estado.nombre = 'CANCELADA_POR_USUARIO';
		this.estado.timestamp = new Date();
		this.estado.transicion_in = 'compraCancelada';
		this.estado.transicion_out = [];

		this.logEstado();

		this.historial_eventos.push({
			orden: this.orden_evento++,
			evento: this.estado.transicion_in
		});
	}

	solicitarAutorizacionPago(data){
		//Estado actual: SOLICITANDO_AUTORIZACION_PAGO
		this.estado.nombre = 'SOLICITANDO_AUTORIZACION_PAGO';
		this.estado.timestamp = new Date();
		this.estado.transicion_in = 'autorizarPago';
		this.estado.transicion_out = [];
		this.logEstado();
		
		if (this.data.resultado_infraccion === 'sinInfraccion'){
			var topico = '.pagos.';
			var mensaje = new Object();
			mensaje.evento = 'autorizarPago';
			mensaje.data = this.data;
			this.server.publicarMensaje(topico, JSON.stringify(mensaje));
		}else if (this.data.resultado_infraccion === 'conInfraccion'){
			this.emit('compraConInfraccion');	
		}

		this.historial_eventos.push({
			orden: this.orden_evento++,
			evento: this.estado.transicion_in
		});
	
	}

	procesarAutorizacionPago(data){
		//Estado actual: PROCESANDO_AUTORIZACION_PAGO
		this.estado.nombre = 'PROCESANDO_AUTORIZACION_PAGO';
		this.estado.timestamp = new Date();
		this.estado.transicion_in = 'autorizacionPago';
		
		//Se actualiza data
		this.data.pago_id = data.pago_id;
		this.data.pago_rechazado = data.pago_rechazado;
		
		if ( data.pago_rechazado === 'F' ) {
			if ( this.data.forma_entrega === 'correo') {
				this.estado.transicion_out = ['agendarEnvio'];	
			}else if (this.data.forma_entrega === 'retira'){
				this.estado.transicion_out = [];
				this.emit('compraConcretada', '[modo_entrega = retira]');
			}
		}else if ( data.pago_rechazado === 'V'){
			this.estado.transicion_out = [];
			this.emit('pagoRechazado');
		}

		this.logEstado();

		this.historial_eventos.push({
			orden: this.orden_evento++,
			evento: this.estado.transicion_in
		});
	}

	solicitarAgendarEnvio(){
		//Estado actual: SOLICITANDO_AGENDAR_ENVIO
		this.estado.nombre = 'SOLICITANDO_AGENDAR_ENVIO';
		this.estado.timestamp = new Date();
		this.estado.transicion_in = 'agendarEnvio';
		this.estado.transicion_out = [];
		this.logEstado();
		
		var topico = '.envios.';
		var mensaje = new Object();
		mensaje.evento = 'agendarEnvio';
		mensaje.data = this.data;
		this.server.publicarMensaje(topico, JSON.stringify(mensaje));

		this.historial_eventos.push({
			orden: this.orden_evento++,
			evento: this.estado.transicion_in
		});
		
		this.emit('compraConcretada', '[agendarEnvioSolicitado]');
	}

	informarCompraConcretada(origen){
		//Estado actual: COMPRA_CONCRETADA
		this.estado.nombre = 'COMPRA_CONCRETADA';
		this.estado.timestamp = new Date();
		this.estado.transicion_in = origen;
		this.estado.transicion_out = [];
		this.logEstado();
		
		var topico = '.web.';
		var mensaje = new Object();
		mensaje.evento = 'compraConcretada';
		mensaje.data = this.data;
		this.server.publicarMensaje(topico, JSON.stringify(mensaje));

		this.historial_eventos.push({
			orden: this.orden_evento++,
			evento: this.estado.transicion_in
		});
	}

	informarPagoRechazado(){
		//Estado actual: PAGO_RECHAZADO
		this.estado.nombre = 'PAGO_RECHAZADO';
		this.estado.timestamp = new Date();
		this.estado.transicion_in = '[pago_rechadado = V]';
		this.estado.transicion_out = [];
		this.logEstado();
		
		var topico = '.web.';
		var mensaje = new Object();
		mensaje.evento = 'pagoRechazado'; 
		mensaje.data = this.data;
		this.server.publicarMensaje(topico, JSON.stringify(mensaje));

		this.historial_eventos.push({
			orden: this.orden_evento++,
			evento: this.estado.transicion_in
		});
	}

	//Se informa compra rechazada por "Infraccion"
	infomarCompraRechazada(){
		//Estado actual: RECHAZADA_POR_INFRACCION
		this.estado.nombre = 'RECHAZADA_POR_INFRACCION';
		this.estado.timestamp = new Date();
		this.estado.transicion_in = '[resultado_infraccion = conInfraccion]';
		this.estado.transicion_out = [];
		this.logEstado();

		var topico = '.web.';
		var mensaje = new Object();
		mensaje.evento = 'compraRechazadaPorInfraccion'; 
		mensaje.data = this.data;
		this.server.publicarMensaje(topico, JSON.stringify(mensaje));

		this.historial_eventos.push({
			orden: this.orden_evento++,
			evento: this.estado.transicion_in
		});

	}

	logEstado(){
		console.log('------------------------------------------');
		console.log('N° Compra: ' + this.num_compra);
		console.log('Estado: ' + this.estado.nombre);
		console.log('------------------------------------------');
		var msg = 'N° Compra: ' + this.num_compra;
		msg = msg + '\\nEstado: ' + this.estado.nombre;
		this.server.logMonitor(msg);
	}

}

module.exports = Compra;
