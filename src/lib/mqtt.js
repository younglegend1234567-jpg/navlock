import mqtt from "mqtt"

export const MQTT_TOPICS = {
  command: "navlock/variruujpdsivihzfcjo/door/command",
  status: "navlock/variruujpdsivihzfcjo/door/status",
  online: "navlock/variruujpdsivihzfcjo/door/online",
  log: "navlock/variruujpdsivihzfcjo/access/log",
}

export function createMqttClient() {
  const protocol = import.meta.env.VITE_MQTT_PROTOCOL || "ws"
  const host = import.meta.env.VITE_HIVEMQ_HOST || "broker.hivemq.com"
  const port = import.meta.env.VITE_HIVEMQ_WS_PORT || "8000"
  const username = import.meta.env.VITE_HIVEMQ_USERNAME
  const password = import.meta.env.VITE_HIVEMQ_PASSWORD

  const options = {
    clean: true,
    reconnectPeriod: 3000,
    connectTimeout: 10000,
    clientId: `navlock_web_${Math.random().toString(16).slice(2)}`,
  }

  if (username && password) {
    options.username = username
    options.password = password
  }

  return mqtt.connect(`${protocol}://${host}:${port}/mqtt`, options)
}
