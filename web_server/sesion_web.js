const EventEmitter = require('events').EventEmitter;
var amqp = require('amqplib');

'use strict';

class SesionWeb extends EventEmitter {
	constructor (sesion_id, usuario_id){
		super();
		this.compra = new Object();
		this.compra.sesion_id = sesion_id;
		this.compra.comprador = usuario_id;
		this.compra.estado = 'sesionIniciada';

		//Se registran los eventos a escuchar
		this.on('iniciarCompra', (publ, cant) => this.iniciarCompra(publ, cant));
		this.on('compraGenerada', (publ_id, cant, compra_id) => this.responderCompraGenerada(publ_id, cant, compra_id));
		this.on('modoEntregaSeleccionado', (forma) => this.establecerEntrega(forma));
		this.on('importeCalculado', (sub, costo, total) => this.devolverImporte(sub, costo, total));
		this.on('pagoEstablecido', (medio, tarjeta) => this.establecerPago(medio, tarjeta));
		this.on('confirmarCompra', () => this.devolverCompraConfirmada());

	}

	iniciarCompra (publicacion, cantidad){
		console.log('[SesionWeb]: Iniciando compra. Sesion: ' + this.sesion_id);
		this.compra.publicacion = publicacion;
		this.compra.cantidad = cantidad;
		
		//Se publica mensaje "<nuevaCompra>" para servidor de compras
		var mensaje = new Object();
		mensaje.evento = 'nuevaCompra';
		mensaje.data = this.compra;
		this.publicarMensaje('.compras.', JSON.stringify(mensaje));
		this.compra.estado = 'compraIniciada';
	}

	responderCompraGenerada(publicacion_id, cantidad, compra_id){
		this.compra.compra_id = compra_id;
		this.compra.estado = 'compraGenerada';

		//enviar como respuesta al browser el 'id' de la compra iniciada
		console.log('Enviando respuesta al usuario .. compra_id: ' + compra_id, ' - publicacion_id: ' + publicacion_id);
	}

	establecerEntrega (formaEntrega){
		this.compra.formaEntrega = formaEntrega;

		//Se publica mensaje <<entregaSeleccionada>> para el servidor de compras
		var mensaje = new Object();
		mensaje.evento = 'entregaSeleccionada';
		mensaje.data = {
			compra_id : this.compra.compra_id,
			forma_entrega: formaEntrega
		};
		this.publicarMensaje('.compras.', JSON.stringify(mensaje));
		this.compra.estado = 'modoEntregaSeleccionado';
	}

	devolverImporte(subTotal, costoEnvio, importeTotal){
		this.compra.subTotal = subTotal;
		this.compra.costoEnvio = costoEnvio;
		this.compra.importeTotal = importeTotal;

		//enviar como respuesta al browser el 'id' de la compra iniciada
		console.log('Enviando respuesta al usuario .. compra_id: ' + this.compra.compra_id
					+ ' - sub_total: '+ subTotal + ' - costo_envio: '+costoEnvio+ ' - importe_total: '+importeTotal);
		
		this.compra.estado = 'costoCompraCalculado';			
	}

	establecerPago(numMedioPago, numTarjeta){
		this.compra.medioPago = numMedioPago;
		this.compra.numTarjeta = numTarjeta;

		//Se publica mensaje <<establecerPago>> para el servidor de compras
		var mensaje = new Object();
		mensaje.evento = 'establecerPago';
		mensaje.data = {
			num_medio_pago : numMedioPago,
			num_tarjeta : numTarjeta
		};
		this.publicarMensaje('.compras.', JSON.stringify(mensaje));
		this.compra.estado = 'medioPagoEstablecido';
	}

	devolverCompraConfirmada(){
		this.estado = 'compraConfirmada';
		//enviar como respuesta al browser el aviso de compra confirmada
		console.log('Enviando respuesta al usuario ... compra_id: ' + this.compra.compra_id + ' CONFIRMADA.');
	}
	
	publicarMensaje(topico, mensaje){
		amqp.connect('amqp://localhost')
			.then(function(con){
				con.createChannel()
					.then(function(chnl){
						var ex = 'compras.topic';
						chnl.assertExchange(ex, 'topic', {durable: true});
						chnl.publish(ex, topico, new Buffer(mensaje));
						console.log(' [x] Enviando %s: \'%s\'', topico, mensaje);
					})
					.catch(function(err){
						console.error('[SesionWeb]: Error Creando canal: ' + err);
					});
			})
			.catch( function(err){
				console.error('[SesionWeb]: Error conectando a servidor de mensajeria: ' + err);
			});
	}

	get estado (){
		return this.compra.estado;
	}
}

module.exports = SesionWeb;