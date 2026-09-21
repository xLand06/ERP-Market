# TÉRMINOS Y CONDICIONES DEL SERVICIO, POLÍTICA DE DATOS Y SLA
**ALL MARKET ERP — Plataforma Cloud Multi-Tenant**  
*Última actualización: Septiembre 2026*

---

## 1. Naturaleza del Servicio y Objeto
El presente documento establece los términos contractuales, derechos, obligaciones y políticas de tratamiento de datos que rigen el uso de la plataforma de software como servicio (**SaaS**) **ALL MARKET ERP**, provista a personas naturales y jurídicas ("El Cliente" o "Tenant").

---

## 2. Soberanía y Propiedad Exclusiva de los Datos
1. **Propiedad del Cliente**: El Cliente es y seguirá siendo en todo momento el **único y exclusivo propietario** de la totalidad de los datos, información comercial, registros contables, catálogos de productos, listas de precios, base de clientes, transacciones de venta, compras, comprobantes y movimientos de inventario almacenados en su instancia.
2. **Rol de ALL MARKET**: La plataforma actúa exclusivamente como proveedor de infraestructura técnica y procesador de datos. ALL MARKET no venderá, cederá, compartirá ni utilizará la información del Cliente para fines comerciales, publicitarios o de minería de datos ajenos a la operación estricta del ERP.
3. **Confidencialidad**: Toda la información almacenada en los contenedores y bases de datos aisladas de cada tenant es estrictamente confidencial.

---

## 3. Garantía de Portabilidad de Datos (Zero Vendor Lock-in)
Creemos en relaciones comerciales transparentes basadas en el valor del servicio y no en la retención cautiva:

1. **Derecho a la Portabilidad**: El Cliente tiene derecho a solicitar y descargar la totalidad de sus datos en cualquier momento, ya sea durante la vigencia activa de su suscripción o al decidir su cancelación o no renovación.
2. **Formatos de Entrega Disponibles**:
   - **Copia de Seguridad Completa de Base de Datos (`.sql.gz`)**: Respaldo nativo de PostgreSQL estructurado sin bloqueos propietarios ni ataduras de licencias. Cualquier administrador de sistemas o desarrollador puede restaurar esta copia directamente en un servidor PostgreSQL propio (`psql` / `pg_restore`) de forma inmediata.
   - **Exportación Universal de Negocio**: Reportes tabulares en formatos abiertos (CSV / Excel / JSON) con inventario, clientes, ventas y saldos para facilitar la migración a cualquier otra herramienta de mercado.
3. **Sin Costos de Rescate ni Penalidades**: No se aplican cargos, tarifas de salida ni trabas administrativas para la entrega o descarga de los datos del Cliente.

---

## 4. Política de Copias de Seguridad (Backups) y Almacenamiento
1. **Generación y Compresión de Alto Rendimiento**: Las copias de seguridad se generan bajo demanda y de manera programada con algoritmos de máxima compresión (`gzip -9` / `--no-owner --no-privileges`), garantizando la mínima ocupación de disco y máxima portabilidad.
2. **Política de Retención y Rotación Automática**:
   - Con el fin de evitar la saturación de almacenamiento y preservar la eficiencia del servidor, el sistema mantiene un historial rotativo de hasta **7 copias de seguridad por cliente**.
   - Los respaldos con una antigüedad superior a **30 días** son rotados y depurados automáticamente una vez cumplida la cuota de retención.
3. **Recomendación de Resguardo Local**: Si bien la infraestructura cuenta con redundancia, se recomienda al Cliente descargar periódicamente una copia de seguridad para su archivo histórico local.

---

## 5. Ciclo de Facturación, Periodos de Gracia y Pagos
1. **Vencimiento de Factura (Día 0)**: Las suscripciones se abonan de forma mensual o anual anticipada según el plan contratado.
2. **Período de Gracia Operativa (Días 1 al 7)**:
   - Tras la fecha de vencimiento, el Cliente cuenta con un **período de gracia de 7 días continuos**.
   - Durante este período, el servicio se mantiene **100% operativo** sin suspensión de funciones ni interrupción de ventas en sus sucursales.
   - El sistema mostrará un aviso recordatorio discreto en el módulo de facturación.
3. **Pruebas Gratuitas (Trials)**: Las instancias en periodo de prueba cuentan con un periodo de gracia operativa de **24 horas** posteriores a la finalización de los 14 días de prueba.

---

## 6. Suspensión Preventiva, Custodia y Purga Automática
Si transcurrido el período de gracia no se ha registrado la regularización de la suscripción:

1. **Suspensión Preventiva (Día 8 post-vencimiento)**:
   - Se detienen temporalmente los contenedores de aplicación del tenant para optimizar los recursos del servidor.
   - **Los datos, transacciones y volúmenes de base de datos se mantienen 100% intactos**.
2. **Período de Custodia Garantizada (30 Días)**:
   - Durante los **30 días siguientes a la suspensión**, ALL MARKET custodia la base de datos íntegra del Cliente.
   - En cualquier momento durante este lapso, el Cliente puede:
     - Regularizar su suscripción para reactivar el sistema inmediatamente sin pérdida de información.
     - Solicitar la entrega de su copia de seguridad completa (`.sql.gz`) para llevársela sin costo.
3. **Purga Automática Definitiva (Garbage Collection)**:
   - **Cuentas de Pago**: Si transcurren **45 días continuos de suspensión** (30 días de custodia formal + 15 días de margen de notificación final) sin reactivación ni solicitud de portabilidad, el sistema procederá a la **eliminación definitiva e irreversible** de los contenedores y volúmenes de datos asociados al tenant.
   - **Cuentas de Prueba (Trials)**: Las instancias de prueba abandonadas sin pagos registrados serán purgadas tras **14 días de suspensión**.

---

## 7. Disponibilidad de Servicio (SLA) y Soporte
1. **Nivel de Servicio**: ALL MARKET tiene como objetivo un tiempo de actividad (*uptime*) del **99.5%** mensual para las instancias activas, excluyendo ventanas de mantenimiento programadas comunicadas previamente.
2. **Soporte Técnico**: Se brinda asistencia para incidentes de plataforma, resolución de dudas operativas y facilitación de accesos de soporte auditados en tiempo real.

---

## 8. Aceptación
El uso de la plataforma ALL MARKET ERP o la contratación de cualquiera de sus planes implica la lectura, entendimiento y aceptación plena de estos Términos y Condiciones.
