import { carrinhoUseCases } from "./cases/carrinho.use-cases.js";
import { pedidoCanceladoUseCases } from "./cases/pedido-cancelado.use-cases.js";
import { pedidoRecebidoUseCases } from "./cases/pedido-recebido.use-cases.js";
import { pedidoPagoUseCases } from "./cases/pedido-pago.use-cases.js";
import { pedidoEnviadoUseCases } from "./cases/pedido-enviado.use-cases.js";
import { pedidoEntregueUseCases } from "./cases/pedido-entregue.use-cases.js";

export const shotzapUseCases = [
  ...carrinhoUseCases,
  ...pedidoCanceladoUseCases,
  ...pedidoRecebidoUseCases,
  ...pedidoPagoUseCases,
  ...pedidoEnviadoUseCases,
  ...pedidoEntregueUseCases
];

export const findUseCaseByName = (name) => {
  const normalized = name.toLowerCase();
  return shotzapUseCases.find((useCase) =>
    useCase.aliases.some((alias) => alias.toLowerCase().includes(normalized))
  );
};
