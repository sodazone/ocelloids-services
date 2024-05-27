import { Counter, CounterConfiguration, register } from 'prom-client'

export function getOrCreateCounter(config: CounterConfiguration<string>) {
  return (register.getSingleMetric(config.name) as Counter) ?? new Counter(config)
}
