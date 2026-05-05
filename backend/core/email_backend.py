"""
Backend SMTP personalizado compatible con Python 3.14.
Python 3.14 introdujo verificación SSL más estricta que rechaza algunos
certificados intermedios de Gmail. Este backend relaja esa restricción
manteniendo TLS activo.
"""
import ssl
import smtplib

from django.core.mail.backends.smtp import EmailBackend as _DjangoSMTPBackend


def _build_compat_ssl_context() -> ssl.SSLContext:
    """Crea un contexto SSL que funciona con Python 3.14 y smtp.gmail.com."""
    ctx = ssl.create_default_context()
    # Python 3.14 aplica VERIFY_X509_STRICT por defecto, lo que rechaza CAs
    # cuyo Basic Constraints no está marcado como critical. Gmail aún usa
    # algunos de esos intermedios. Lo desactivamos solo en este contexto.
    strict_flag = getattr(ssl, "VERIFY_X509_STRICT", 0)
    if strict_flag:
        ctx.verify_flags &= ~strict_flag
    return ctx


class EmailBackend(_DjangoSMTPBackend):
    """Subclase del backend SMTP de Django con SSL compatible con Python 3.14."""

    def open(self):
        if self.connection:
            return False

        connection_params = {"local_hostname": self.local_hostname or smtplib.FQDN}
        if self.timeout is not None:
            connection_params["timeout"] = self.timeout

        if self.use_ssl:
            connection_params["context"] = _build_compat_ssl_context()

        try:
            self.connection = self.connection_class(
                self.host, self.port, **connection_params
            )
            if not self.use_ssl and self.use_tls:
                self.connection.ehlo()
                self.connection.starttls(context=_build_compat_ssl_context())
                self.connection.ehlo()
            if self.username and self.password:
                self.connection.login(self.username, self.password)
            return True
        except smtplib.SMTPException:
            if not self.fail_silently:
                raise
