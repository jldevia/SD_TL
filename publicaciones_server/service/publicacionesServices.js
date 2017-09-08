var mod_serv_publicaciones = (function () {
	
	function handleSolicitud(solicitud) {
		var respuesta;
		
		switch (solicitud.accion) {
		case 'lista_publicaciones':
			respuesta = [{
				numero : "45786",
				desde : "25/06/2017",
				hasta : "12/12/2017",
				cant_ofertada : "25"
			},
			{
				numero : "4899966",
				desde : "01/08/2017",
				hasta : "12/10/2017",
				cant_ofertada : "50"
			},
			{
				numero : "666",
				desde : "01/08/2017",
				hasta : "12/10/2017",
				cant_ofertada : "34"
			}
			];
			break;
		case 'lista_acciones':
			respuesta = getAcciones();
			break;	
		default:
			respuesta = { "resultado" : "Sin resultados"};
			break;
		}

		return JSON.stringify(respuesta);
	}

	function getAcciones(){
		return [
			{accion: "lista_publicaciones"},
			{accion: "lista_acciones"},
			{accion: "reservar_producto"},
			{accion: "liberar_producto"},
			{accion: "crear_publicacion"},
			{accion: "editar_publicacion"},
			{accion: "eliminar_publicacion"}
		];
	}

	return {
		handle : handleSolicitud
	};
})();

module.exports.service = mod_serv_publicaciones;