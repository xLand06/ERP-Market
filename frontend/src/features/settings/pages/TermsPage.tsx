// =============================================================================
// TERMS & CONDITIONS — ALL MARKET
// Términos, condiciones, política de privacidad y soporte.
// =============================================================================

import { useState } from 'react';
import { FileText, Shield, CreditCard, Headphones, ChevronDown, ChevronUp, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type Section = 'terms' | 'privacy' | 'subscription' | 'support';

const SECTIONS = [
    { id: 'terms' as Section, icon: FileText, title: 'Términos y Condiciones', color: 'text-blue-600', bg: 'bg-blue-50' },
    { id: 'privacy' as Section, icon: Shield, title: 'Política de Privacidad', color: 'text-emerald-600', bg: 'bg-emerald-50' },
    { id: 'subscription' as Section, icon: CreditCard, title: 'Términos de Suscripción', color: 'text-purple-600', bg: 'bg-purple-50' },
    { id: 'support' as Section, icon: Headphones, title: 'Soporte y Garantías', color: 'text-amber-600', bg: 'bg-amber-50' },
];

function Accordion({ title, children, defaultOpen = false }: { title: string; children: React.ReactNode; defaultOpen?: boolean }) {
    const [open, setOpen] = useState(defaultOpen);
    return (
        <div className="border border-slate-200 rounded-xl overflow-hidden">
            <button
                type="button"
                onClick={() => setOpen(!open)}
                className="w-full flex items-center justify-between px-5 py-4 bg-white hover:bg-slate-50 transition-colors cursor-pointer"
            >
                <span className="text-sm font-bold text-slate-800">{title}</span>
                {open ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
            </button>
            {open && <div className="px-5 pb-5 text-sm text-slate-600 leading-relaxed space-y-3 border-t border-slate-100 pt-4">{children}</div>}
        </div>
    );
}

function TermsContent() {
    return (
        <div className="space-y-4">
            <Accordion title="1. Aceptación de los Términos" defaultOpen>
                <p>Al acceder y utilizar ALL MARKET ("el Sistema"), usted acepta estar sujeto a estos Términos y Condiciones de uso. Si no está de acuerdo con alguno de estos términos, no debe utilizar el Sistema.</p>
                <p>ALL MARKET es una plataforma ERP (Enterprise Resource Planning) desarrollada por ALLCODE para la gestión de negocios de tiendas, abastos y comercios en Venezuela.</p>
            </Accordion>
            <Accordion title="2. Descripción del Servicio">
                <p>ALL MARKET proporciona las siguientes funcionalidades:</p>
                <ul className="list-disc list-inside space-y-1 ml-2">
                    <li>Punto de Venta (POS) con escaneo de código de barras</li>
                    <li>Gestión de inventario y stock por sucursal</li>
                    <li>Control de clientes y créditos (fiados)</li>
                    <li>Gestión de proveedores y compras</li>
                    <li>Reportes y análisis de negocio</li>
                    <li>Control de cajas y flujo de caja</li>
                    <li>Gestión de bancos y conciliación</li>
                    <li>Cotizaciones y presupuestos</li>
                    <li>Catálogo digital público</li>
                    <li>Asistente de inteligencia artificial</li>
                </ul>
            </Accordion>
            <Accordion title="3. Cuentas de Usuario">
                <p>Usted es responsable de mantener la confidencialidad de su contraseña y de todas las actividades que ocurran bajo su cuenta. Usted acepta notificar inmediatamente a ALLMARKET sobre cualquier uso no autorizado de su cuenta.</p>
                <p>ALL MARKET se reserva el derecho de suspender o eliminar cuentas que violen estos términos.</p>
            </Accordion>
            <Accordion title="4. Uso Aceptable">
                <p>Usted acepta utilizar el Sistema únicamente para fines legales y de acuerdo con estos términos. Está prohibido:</p>
                <ul className="list-disc list-inside space-y-1 ml-2">
                    <li>Usar el Sistema para cualquier propósito ilegal</li>
                    <li>Intentar acceder a cuentas de otros usuarios</li>
                    <li>Interferir con el funcionamiento del Sistema</li>
                    <li>Realizar ingeniería inversa del código fuente</li>
                    <li>Compartir credenciales con terceros no autorizados</li>
                </ul>
            </Accordion>
            <Accordion title="5. Propiedad Intelectual">
                <p>Todo el contenido, diseño, código fuente y demás elementos intelectuales de ALL MARKET son propiedad exclusiva de ALLCODE. Queda prohibida su reproducción, distribución o modificación sin autorización previa por escrito.</p>
            </Accordion>
            <Accordion title="6. Limitación de Responsabilidad">
                <p>ALL MARKET se proporciona "tal cual" sin garantías de ningún tipo. En ningún caso ALLCODE será responsable por daños indirectos, incidentales, especiales o consecuentes que resulten del uso del Sistema.</p>
                <p>Los datos almacenados en el Sistema son responsabilidad del usuario. ALL MARKET recomienda realizar copias de seguridad periódicas.</p>
            </Accordion>
            <Accordion title="7. Modificaciones">
                <p>ALLCODE se reserva el derecho de modificar estos términos en cualquier momento. Las modificaciones entrarán en vigor inmediatamente después de su publicación en el Sistema. El uso continuado del Sistema después de las modificaciones constituye la aceptación de los nuevos términos.</p>
            </Accordion>
        </div>
    );
}

function PrivacyContent() {
    return (
        <div className="space-y-4">
            <Accordion title="1. Información que Recopilamos" defaultOpen>
                <p>Recopilamos la siguiente información:</p>
                <ul className="list-disc list-inside space-y-1 ml-2">
                    <li><strong>Datos de cuenta:</strong> nombre, correo electrónico, contraseña (encriptada), cédula/RIF</li>
                    <li><strong>Datos de negocio:</strong> nombre del negocio, dirección, teléfono, RIF</li>
                    <li><strong>Datos de uso:</strong> transacciones, inventario, ventas, compras</li>
                    <li><strong>Datos de clientes:</strong> nombres, cédulas, teléfonos, balances (si el usuario los registra)</li>
                </ul>
            </Accordion>
            <Accordion title="2. Uso de la Información">
                <p>Utilizamos su información para:</p>
                <ul className="list-disc list-inside space-y-1 ml-2">
                    <li>Proveer y mantener el servicio</li>
                    <li>Mejorar la experiencia del usuario</li>
                    <li>Enviar notificaciones sobre el servicio</li>
                    <li>Cumplir obligaciones legales</li>
                    <li>Generar reportes agregados y anónimos de uso</li>
                </ul>
            </Accordion>
            <Accordion title="3. Protección de Datos">
                <p>Sus datos son protegidos mediante:</p>
                <ul className="list-disc list-inside space-y-1 ml-2">
                    <li>Encriptación SSL/TLS en todas las comunicaciones</li>
                    <li>Contraseñas encriptadas con bcrypt</li>
                    <li>Acceso restringido por roles y permisos</li>
                    <li>Backups automáticos diarios</li>
                    <li>Servidores en infraestructura segura</li>
                </ul>
            </Accordion>
            <Accordion title="4. Compartir Información">
                <p>No vendemos ni compartimos su información personal con terceros, excepto:</p>
                <ul className="list-disc list-inside space-y-1 ml-2">
                    <li>Cuando sea requerido por ley</li>
                    <li>Para proteger los derechos de ALL MARKET</li>
                    <li>Con proveedores de servicios que nos ayudan a operar (hosting, pagos)</li>
                </ul>
            </Accordion>
            <Accordion title="5. Sus Derechos">
                <p>Usted tiene derecho a:</p>
                <ul className="list-disc list-inside space-y-1 ml-2">
                    <li>Acceder a sus datos personales</li>
                    <li>Corregir datos inexactos</li>
                    <li>Solicitar la eliminación de sus datos</li>
                    <li>Exportar sus datos en formato estándar</li>
                    <li>Oponerse al procesamiento de sus datos</li>
                </ul>
            </Accordion>
            <Accordion title="6. Retención de Datos">
                <p>Sus datos se mantienen mientras su cuenta esté activa. Tras la cancelación, los datos se retienen por 90 días para permitir la recuperación, después se eliminan permanentemente.</p>
            </Accordion>
            <Accordion title="7. Cookies y Tecnologías de Rastreo">
                <p>Utilizamos cookies esenciales para el funcionamiento del Sistema. No utilizamos cookies de rastreo publicitario. Puede configurar su navegador para rechazar cookies, aunque esto podría afectar el funcionamiento del Sistema.</p>
            </Accordion>
        </div>
    );
}

function SubscriptionContent() {
    return (
        <div className="space-y-4">
            <Accordion title="1. Planes y Precios" defaultOpen>
                <div className="space-y-3">
                    <div className="p-3 bg-slate-50 rounded-lg">
                        <p className="font-bold text-slate-800">Free / Trial</p>
                        <p className="text-xs text-slate-500">Gratis por 14 días · 2 usuarios · 250 productos</p>
                    </div>
                    <div className="p-3 bg-slate-50 rounded-lg">
                        <p className="font-bold text-slate-800">Básico — $10/mes o $100/año</p>
                        <p className="text-xs text-slate-500">2 usuarios · 1 sucursal · 500 productos</p>
                    </div>
                    <div className="p-3 bg-slate-50 rounded-lg">
                        <p className="font-bold text-slate-800">Pro — $20/mes o $200/año</p>
                        <p className="text-xs text-slate-500">6 usuarios · 2 sucursales · Productos ilimitados</p>
                    </div>
                    <div className="p-3 bg-slate-50 rounded-lg">
                        <p className="font-bold text-slate-800">Premium — $30/mes o $300/año</p>
                        <p className="text-xs text-slate-500">Usuarios ilimitados · 5 sucursales · Todo incluido</p>
                    </div>
                </div>
            </Accordion>
            <Accordion title="2. Ciclo de Facturación">
                <p>Las suscripciones se facturan mensual o anualmente según la opción elegida. El pago se realiza por adelantado al inicio de cada período.</p>
                <p>Los precios están en dólares estadounidenses (USD). Se aceptan pagos en bolívares a la tasa de cambio del día.</p>
            </Accordion>
            <Accordion title="3. Renovación y Cancelación">
                <p>Las suscripciones se renuevan automáticamente al finalizar el período. Puede cancelar su suscripción en cualquier momento desde la configuración de su cuenta.</p>
                <p>Al cancelar:</p>
                <ul className="list-disc list-inside space-y-1 ml-2">
                    <li>El servicio permanece activo hasta el final del período pagado</li>
                    <li>Sus datos se retienen por 90 días</li>
                    <li>Puede exportar sus datos antes de la eliminación</li>
                </ul>
            </Accordion>
            <Accordion title="4. Política de Reembolso">
                <p>Ofrecemos reembolso completo dentro de los primeros 14 días de la suscripción si no está satisfecho. Después de este período, no se realizan reembolsos prorrateados.</p>
                <p>Para solicitar un reembolso, contacte a nuestro equipo de soporte.</p>
            </Accordion>
            <Accordion title="5. Cambios de Plan">
                <p>Puede actualizar o degradar su plan en cualquier momento. Los cambios de plan se aplican inmediatamente y se ajusta la facturación de forma prorrateada.</p>
            </Accordion>
            <Accordion title="6. Limitaciones por Plan">
                <p>Cada plan tiene límites específicos en usuarios, sucursales y productos. Si excede los límites de su plan, se le notificará y se le solicitará actualizar a un plan superior.</p>
            </Accordion>
        </div>
    );
}

function SupportContent() {
    return (
        <div className="space-y-4">
            <Accordion title="1. Canales de Soporte" defaultOpen>
                <div className="space-y-3">
                    <div className="p-3 bg-slate-50 rounded-lg">
                        <p className="font-bold text-slate-800">📧 Email</p>
                        <p className="text-xs text-slate-500">soporte@allcode.site — Respuesta en 24-48 horas</p>
                    </div>
                    <div className="p-3 bg-slate-50 rounded-lg">
                        <p className="font-bold text-slate-800">💬 WhatsApp</p>
                        <p className="text-xs text-slate-500">+58 412-965-7169 — Lunes a Viernes 8am-6pm</p>
                    </div>
                    <div className="p-3 bg-slate-50 rounded-lg">
                        <p className="font-bold text-slate-800">🤖 Asistente IA</p>
                        <p className="text-xs text-slate-500">Disponible 24/7 dentro del Sistema</p>
                    </div>
                </div>
            </Accordion>
            <Accordion title="2. Niveles de Soporte">
                <ul className="list-disc list-inside space-y-1 ml-2">
                    <li><strong>Free/Básico:</strong> Soporte por email en horario laboral</li>
                    <li><strong>Pro:</strong> Soporte prioritario por email y WhatsApp</li>
                    <li><strong>Premium:</strong> Soporte 24/7 por todos los canales + asistencia remota</li>
                </ul>
            </Accordion>
            <Accordion title="3. Tiempos de Respuesta">
                <ul className="list-disc list-inside space-y-1 ml-2">
                    <li><strong>Crítico:</strong> 4 horas (sistema caído, pérdida de datos)</li>
                    <li><strong>Alto:</strong> 8 horas (funcionalidad principal afectada)</li>
                    <li><strong>Medio:</strong> 24 horas (funcionalidad secundaria)</li>
                    <li><strong>Bajo:</strong> 48 horas (consultas, mejoras)</li>
                </ul>
            </Accordion>
            <Accordion title="4. Garantía de Disponibilidad">
                <p>Garantizamos un 99.9% de disponibilidad del servicio medido mensualmente. En caso de caídas no programadas, trabajamos para restaurar el servicio en el menor tiempo posible.</p>
                <p>Las ventanas de mantenimiento programado se notifican con 48 horas de anticipación.</p>
            </Accordion>
            <Accordion title="5. Actualizaciones">
                <p>El Sistema se actualiza automáticamente sin costo adicional. Las actualizaciones incluyen correcciones de errores, mejoras de rendimiento y nuevas funcionalidades.</p>
                <p>Las actualizaciones críticas de seguridad se aplican inmediatamente sin notificación previa.</p>
            </Accordion>
            <Accordion title="6. Limitación de Garantía">
                <p>ALL MARKET se proporciona "tal cual" sin garantías explícitas. No garantizamos que el Sistema será ininterrumpido o libre de errores. Nuestra responsabilidad se limita al valor pagado por el servicio en los últimos 12 meses.</p>
            </Accordion>
        </div>
    );
}

const CONTENT_MAP: Record<Section, () => React.ReactNode> = {
    terms: TermsContent,
    privacy: PrivacyContent,
    subscription: SubscriptionContent,
    support: SupportContent,
};

export default function TermsPage() {
    const navigate = useNavigate();
    const [activeSection, setActiveSection] = useState<Section>('terms');
    const ContentComponent = CONTENT_MAP[activeSection];

    return (
        <div className="flex flex-col gap-6 max-w-4xl mx-auto pb-8">
            {/* Header */}
            <div className="flex items-center gap-4">
                <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="gap-1">
                    <ArrowLeft className="w-4 h-4" /> Volver
                </Button>
                <div>
                    <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                        Términos y Condiciones
                    </h1>
                    <p className="text-xs text-slate-400 mt-1 font-medium">
                        Última actualización: Septiembre 2026
                    </p>
                </div>
            </div>

            {/* Section tabs */}
            <div className="flex gap-2 overflow-x-auto pb-1">
                {SECTIONS.map((s) => {
                    const Icon = s.icon;
                    return (
                        <button
                            key={s.id}
                            onClick={() => setActiveSection(s.id)}
                            className={cn(
                                'flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold whitespace-nowrap transition-all cursor-pointer',
                                activeSection === s.id
                                    ? `${s.bg} ${s.color} shadow-sm`
                                    : 'bg-white text-slate-500 border border-slate-200 hover:border-slate-300'
                            )}
                        >
                            <Icon className="w-4 h-4" />
                            {s.title}
                        </button>
                    );
                })}
            </div>

            {/* Content */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
                <ContentComponent />
            </div>

            {/* Footer */}
            <p className="text-xs text-slate-400 text-center">
                © 2026 ALLCODE · ALL MARKET. Todos los derechos reservados.
            </p>
        </div>
    );
}
