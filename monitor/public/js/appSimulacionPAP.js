var socket = io({transports: ['websocket']});

var app = new Vue ({
	el: '#app',
	data : {
		sesiones_web :[
			{num_compra: 1, sesion_id: 1, evento: 'Evento 1'},
			{num_compra: 2, sesion_id: 2, evento: 'Evento 2'},
			{num_compra: 3, sesion_id: 3, evento: 'Evento 3'},
			{num_compra: 4, sesion_id: 4, evento: 'Evento 4'},
		]
	},
	methods : {

	}
});