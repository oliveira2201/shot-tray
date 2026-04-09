#!/bin/bash
URL=http://localhost:3847/webhook/lumi
PHONE=558688720061
NAME=Felipe

send() {
  local label=$1
  local body=$2
  echo "============================================================"
  echo "TEST: $label"
  echo "body: $body"
  curl -sS -X POST -H 'Content-Type: application/x-www-form-urlencoded' --data "$body" "$URL" -w '\n>> HTTP %{http_code}\n' --max-time 10
  echo
}

# 1. paid → Pedido Pago
send "paid" "taginternals=paid&FNAME=$NAME&phone=$PHONE&TRACKNUMB=https://distribuidoraebenezer.com.br/checkout/v3/success/1924384675/a91c4a268067&email=felipe@test.com"

sleep 2

# 2. delivered → Pedido Entregue
send "delivered" "taginternals=delivered&FNAME=$NAME&phone=$PHONE&TRACKNUMB=https://distribuidoraebenezer.com.br/checkout/v3/success/1937487084/8a6d8025c13a"

sleep 2

# 3. cancelled → Pedido Cancelado1
send "cancelled" "taginternals=cancelled&FNAME=$NAME&phone=$PHONE&TRACKNUMB=https://distribuidoraebenezer.com.br/checkout/v3/success/1936340674/83783ca98b79"

sleep 2

# 4. shipped,open,voided,unpacked → Pedido Enviado
send "shipped,open,voided,unpacked" "taginternals=shipped,open,voided,unpacked&FNAME=$NAME&phone=$PHONE&TRACKNUMB=https://distribuidoraebenezer.com.br/checkout/v3/success/1893409406/991f3b764ca0"

sleep 2

# 5. abandonou.carrinho1,cartaband2 → Carrinho Abandonado2
send "abandonou.carrinho1,cartaband2" "taginternals=abandonou.carrinho1,cartaband2&FNAME=$NAME&phone=$PHONE&abandoned_checkout_url=https://www.distribuidoraebenezer.com.br/checkout/v3/proxy/1938225712/42293e10ff&NAME=Livro%20A%20Dama"
