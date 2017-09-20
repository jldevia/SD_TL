const EventEmitter = require('events').EventEmitter;
var amqp = require('amqplib');

'use strict';

class Compra extends EventEmitter {
	constructor(){
		super();
		this.estado = 'COMPRA_SIN_GENERAR';
		this.num_compra = 0;
		this.comprador = 0;
		this.publicacion_id = 0;
		this.cantidad = 0;
		this.sesion_id = 0; //id de la sesion web del comprador
		this.conInfraccion = false;
		this.pagoSeleccionado = false;

		this.logEstado();
	
		//Eventos
		this.on('nuevaCompra', (data) => this.procesarNuevaCompra(data)); //Evento proveniente del browser
		this.on('compraGenerada', () => this.informarCompraGenerada());
		this.on('resultadoInfraccion', (data) => this.evaluarResultadoInfraccion(data));
		this.on('entregaSeleccionada', (data) => this.procesarEntregaSeleccionada(data));
		this.on('calcularCostoEnvio', () => this.calcularCostoEnvio());
		this.on('costoEnvioCalculado', (data) => this.procesarCostoEnvio(data));
		this.on('importeCompraCalculado', () => this.informarImporteCompra());
		this.on('pagoSeleccionado', (data) => this.procesarPagoSeleccionado(data)); 
		this.on('compraConfirmada', () => this.continuarProcesamientoCompra());
		this.on('autorizarPago', () => this.solicitarAutorizacionPago());
		this.on('autorizacionPago', (data) => this.procesarAutorizacionPago(data) );
		this.on('agendarEnvio', () => this.solicitarAgendarEnvio());
		this.on('compraConcretada', () => this.informarCompraConcretada());
		this.on('pagoRechazado', () => this.informarPagoRechazado());
	}

	procesarNuevaCompra(data){
		this.num_compra = data.num_compra;
		this.comprador = data.comprador_id;
		this.publicacion_id = data.publicacion_id;
		this.cantidad = data.cantidad;
		this.sesion_id = data.sesion_id;
		this.estado = 'COMPRA_GENERADA';
		this.logEstado();

		this.emit('compraGenerada');		
	}

	informarCompraGenerada(){
		var topico = 'infracciones.web.publicaciones';
		var mensaje = new Object();
		mensaje.evento = 'compraGenerada';
		mensaje.data = {
			publicacion_id : this.publicacion_id,
			cantidad : this.cantidad,
			num_compra : this.num_compra,
			comprador_id : this.comprador,
			sesion_id : this.sesion_id
		};

		this.publicarMensaje(topico, JSON.stringify(mensaje));
		
	}

	procesarEntregaSeleccionada(data){
		this.forma_entrega = data.forma_entrega;
		this.estado = 'FORMA_ENTREGA_SELECCIONADA';
		this.logEstado();

		this.emit('calcularCostoEnvio');
	}

	calcularCostoEnvio(){
		if (this.forma_entrega === 'correo'){
			var mensaje = new Object();
			var topico = '.envios.';
			mensaje.evento = 'calcularCostoEnvio';
			mensaje.data = {
				num_compra : this.num_compra,
				publicacion_id : this.publicacion_id,
				forma_entrega : this.forma_entrega
			};
			this.publicarMensaje(topico, JSON.stringify(mensaje));
			this.estado = 'COSTO_ENVIO_SOLICITADO';
			this.logEstado();
		}else{
			var data = {
				num_compra : this.num_compra,
				costo : 0
			};
			this.emit('costoEnvioCalculado', data);
		} 
	}

	procesarCostoEnvio(data){
		var subTotal = Math.random() * 1000;
		var importeTotal = subTotal + Number(data.costo);
		this.sub_total = subTotal;
		this.costo_envio = data.costo;
		this.importe_total = importeTotal;

		this.emit('importeCalculado');
		this.estado = 'COSTO_ENVIO_CALCULADO';
	}

	informarImporteCompra(){
		var topico = '.web.';
		var mensaje = new Object();
		mensaje.evento = 'importeCompraCalculado';
		mensaje.data = {
			num_compra : this.num_compra,
			sesion_id : this.sesion_id,
			sub_total : this.sub_total,
			costo_envio : this.costo_envio,
			importe_total : this.importe_total
		};

		this.publicarMensaje(topico, JSON.stringify(mensaje));
		this.estado = 'IMPORTE_COMPRA_CALCULADO';
		this.logEstado();
	}

	evaluarResultadoInfraccion(data){
		if ( data.resultado === 'conInfraccion' ){
			var mensaje = new Object();
			var topico = '.web.';
			mensaje.evento = 'compraConInfraccion';
			mensaje.data = {
				num_compra : this.num_compra,
				sesion_id : this.sesion_id,
				motivo : data.motivo,
			};
			this.conInfraccion = true;
			this.estado = 'COMPRA_CON_INFRACCION';
			this.logEstado();
			this.publicarMensaje(topico, JSON.stringify(mensaje));

		} else {
			this.conInfraccion = false;
			this.emit('compraConfirmada');
		}
	}

	procesarPagoSeleccionado(data){
		this.medio_pago = data.medio_pago;
		this.num_tarjeta = data.num_tarjeta;
		this.pagoSeleccionado = true;
		
		this.emit('compraConfirmada');
	}

	continuarProcesamientoCompra(){
		//Si el pago ya fue seleccionado y la compra no tiene infraccion se continua
		//con el procesamiento de la compra, se solicita "autorizacion de pago]"
		if ( this.pagoSeleccionado === true && this.conInfraccion === false){
			this.emit('autorizarPago');
		}
	}

	solicitarAutorizacionPago(){
		var topico = '.pagos.';
		var mensaje = new Object();
		mensaje.evento = 'autorizarPago';
		mensaje.data = {
			num_compra : this.num_compra,
			publicacion_id : this.publicacion_id,
			cantidad: this.cantidad,
			medio_pago : this.medio_pago,
			num_tarjeta : this.num_tarjeta
		};

		this.publicarMensaje(topico, JSON.stringify(mensaje));
		this.estado = 'AUTORIZANDO_PAGO';
		this.logEstado();
	}

	procesarAutorizacionPago(data){
		if ( data.rechazado === 'F' ) {
			this.pagoRechazado = false;
			this.num_pago = data.num_pago;
			if ( this.forma_entrega === 'correo') {
				this.emit('agendarEnvio');
			}
			this.emit('compraConcretada');
			this.estado = 'COMPRA_CONCRETADA';
			this.logEstado();
		}else if ( data.rechazado === 'V'){
			this.pagoRechazado = true;
			this.motivoRechazo = data.motivo;
			this.estado = 'PAGO_RECHAZADO';
			this.logEstado();
			this.emit('pagoRechazado');
		}
	}

	solicitarAgendarEnvio(){
		var topico = '.envios.';
		var mensaje = new Object();
		mensaje.evento = 'agendarEnvio';
		mensaje.data = {
			num_compra : this.num_compra,
			publicacion_id : this.publicacion_id,
			cantidad : this.cantidad,
			costo : this.costo_envio
		};
		this.publicarMensaje(topico, JSON.stringify(mensaje));
	}

	informarCompraConcretada(){
		var topico = '.web.';
		var mensaje = new Object();
		mensaje.evento = 'compraConcretada';
		mensaje.data = {
			num_compra : this.num_compra,
			sesion_id : this.sesion_id
		};
		this.publicarMensaje(topico, JSON.stringify(mensaje));
	}

	informarPagoRechazado(){
		var topico = '.web.';
		var mensaje = new Object();
		mensaje.evento = 'pagoRechazado'; 
		mensaje.data = {
			num_compra : this.num_compra,
			sesion_id : this.sesion_id,
			motivo : this.motivo 
		};
		this.publicarMensaje(topico, JSON.stringify(mensaje));
	}

	logEstado(){
		console.log('------------------------------------------');
		console.log('N° Compra: ' + this.num_compra);
		console.log('Estado: ' + this.estado);
		console.log('------------------------------------------');
	}

	publicarMensaje(topico, mensaje){
		amqp.connect('amqp://localhost')
			.then(function(con){
				con.createChannel()
					.then(function(chnl){
						var ex = 'compras.topic';
						chnl.assertExchange(ex, 'topic', {durable: true});
						chnl.publish(ex, topico, new Buffer(mensaje));
						console.log('------------------------------------------');
						console.log('Enviando Mensaje...');
						console.log('Topico: %s. Mensaje: ', topico, mensaje);
						console.log('------------------------------------------');
					})
					.catch(function(err){
						console.error('[Compra]: Error Creando canal: ' + err);
					});
			})
			.catch( function(err){
				console.error('[Compra]: Error conectando a servidor de mensajeria: ' + err);
			});
	}

}

module.exports = Compra;
