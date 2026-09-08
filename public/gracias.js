let numeroPedido = localStorage.getItem("numeroPedido");

let pedido = document.getElementById("pedidoNumero");

if(numeroPedido){

pedido.innerText = "Número de pedido: " + numeroPedido;

}