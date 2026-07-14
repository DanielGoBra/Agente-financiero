import React, { useState } from "react";
import { authService, databaseService } from "../lib/supabase";
import { UserProfile } from "../types";
import { 
  KeyRound, Mail, ArrowRight, Loader2, AlertCircle, Layers
} from "lucide-react";

interface LoginProps {
  onAuthSuccess: (user: UserProfile) => void;
}

export function Login({ onAuthSuccess }: LoginProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setErrorMsg("Por favor, completa todos los campos.");
      return;
    }

    setErrorMsg(null);
    setIsLoading(true);

    try {
      const { user, error } = await authService.signIn(email, password);
      if (error) {
        setErrorMsg(error);
      } else if (user) {
        // Log activity
        await databaseService.logActivity(user.id, user.email, "LOGIN", "Inicio de sesión exitoso");
        onAuthSuccess(user);
      }
    } catch (err: any) {
      console.error(err);
      setErrorMsg("Ocurrió un error inesperado al conectar con el servicio de autenticación.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-slate-950 flex items-center justify-center p-4 md:p-8 relative overflow-hidden font-sans">
      
      {/* Decorative Blur Backgrounds */}
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-teal-500/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-teal-600/10 rounded-full blur-[120px] pointer-events-none" />
      
      <div className="w-full max-w-[440px] z-10 flex flex-col gap-6">
        
        {/* Logo / Header Branding */}
        <div className="text-center">
          <div className="inline-flex p-3 bg-teal-950/80 border border-teal-800/40 rounded-2xl text-teal-400 mb-3 shadow-md">
            <Layers size={28} />
          </div>
          <h2 className="text-[10px] uppercase font-bold tracking-widest text-teal-400 mb-1">
            Plataforma de Prospección Comercial
          </h2>
          <h1 className="text-2xl font-bold text-white tracking-tight">
            Localizador <span className="text-teal-400 font-serif italic font-light">PYMEs</span>
          </h1>
        </div>

        {/* Main Card */}
        <div className="bg-slate-900/90 border border-slate-800/60 rounded-3xl p-6 md:p-8 shadow-2xl backdrop-blur-xl">
          
          <h3 className="text-lg font-bold text-white mb-6 text-center">
            Iniciar Sesión
          </h3>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            
            <div className="space-y-1">
              <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Correo Electrónico</label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-3.5 text-slate-500" size={15} />
                <input
                  type="email"
                  required
                  placeholder="ejemplo@banco.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-3 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all font-medium"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Contraseña</label>
              <div className="relative">
                <KeyRound className="absolute left-3.5 top-3.5 text-slate-500" size={15} />
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-3 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all font-medium"
                />
              </div>
            </div>

            {errorMsg && (
              <div className="bg-rose-950/40 border border-rose-900/30 p-3 rounded-xl text-rose-300 text-[11px] leading-relaxed flex items-start gap-2">
                <AlertCircle size={14} className="text-rose-500 flex-shrink-0 mt-0.5" />
                <span>{errorMsg}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-teal-600 hover:bg-teal-500 text-white font-semibold py-3 rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-teal-900/20 text-xs uppercase tracking-wider disabled:bg-slate-800 disabled:text-slate-500 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <>
                  <Loader2 size={14} className="animate-spin text-slate-500" />
                  Procesando...
                </>
              ) : (
                <>
                  Acceder a la plataforma
                  <ArrowRight size={13} />
                </>
              )}
            </button>

          </form>
        </div>

        {/* Footer Credentials Info */}
        <p className="text-center text-[10px] text-slate-500 leading-normal">
          Protegido mediante políticas RLS y cifrado de extremo a extremo.<br />
          © {new Date().getFullYear()} Banco Corporativo. Todos los derechos reservados.
        </p>

      </div>
    </div>
  );
}
