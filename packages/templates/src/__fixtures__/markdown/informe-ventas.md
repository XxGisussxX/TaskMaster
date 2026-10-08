# Informe de ventas

## Resumen ejecutivo

Las ventas del trimestre crecieron un **12%** frente al periodo anterior, con
picos en _agosto_ gracias a la campaña `rebaja-verano`. La hipótesis publicada
en el [informe técnico](https://example.com/informes/tecnico-2026) se mantiene:
el canal online concentra el 64% del total.

## Desglose por canal

| Canal    | Trimestre | Var. |
| :------- | :-------: | ---: |
| Online   |  412.400  | +12% |
| Tiendas  |  186.900  |  -3% |
| Partners |  89.200   |  +5% |

## Acciones propuestas

1. Subir la inversión en el canal online.
2. Renegociar tarifas con los partners regionales.
3. Lanzar el plan de fidelidad en **febrero**.

## Campaña rebaja-verano

- [x] Creatividades aprobadas
- [x] Landing publicada
- [ ] Segmento de clientes inactivos
- [ ] Informe de resultados

## Notas metodológicas

> Los datos provienen del almacén de ventas consolidado al cierre de cada mes.
>
> - El tipo de cambio se congeló al primer día del trimestre.

---

Para reproducir la extracción:

```ts
const rows = await store.ventas(query("2026-Q3"));
console.log(rows.length);
```

Para más detalle ver el [anexo](#anexo) o el material adjunto.
