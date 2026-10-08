# Proyecto Alma

## Estado actual

El proyecto continúa en la fase de _construcción_. El backend soporta
autenticación con **JWT** y el frontend **React 19**.

### Módulos

#### Autenticación

Listo desde r0.1.2. La sesión expira a los 30 minutos.

#### Reporting

- [x] Exporte histórica
- [x] Plantillas base
- [ ] Dashboard en vivo

### Arquitectura

```
apps/
  api/       API REST (NestJS)
  web/       SPA (React + Vite)
packages/
  contracts/ tipos compartidos
```

### Decisiones

> 1. Se descartó Postgres en favor de MySQL para el módulo de facturación.
> 2. El equipo aceptó el costo de migrar después del Q4.
>
> Fuente: acta del 12/09/2026.

---

## Plan Q4

| Tarea              | Dueño   | Prioridad |
| ------------------ | ------- | :-------: |
| Code freeze        | Devops  |   Alta    |
| Pruebas de carga   | QA      |   Media   |
| Migración facturas | Backend |   Alta    |

## Enlaces útiles

- [Repo](https://github.com/example/alma)
- [Design system](/design-system)
- [Imagen de arquitectura](/static/arch.png)

## Definiciones

[ref]: https://example.com/diccionario

El término _lancha_ se define según la referencia [ref].

## Notas sueltas

Este párrafo contiene un salto de línea forzado al final\
y continúa en la siguiente línea.

<br/>

Fin del documento.
