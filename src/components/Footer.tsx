const Footer = () => (
  <footer className="border-t border-border py-10 px-4">
    <div className="container mx-auto flex flex-col gap-6">
      <div className="flex flex-col md:flex-row items-center justify-between gap-4">
        <span className="text-lg font-heading font-bold text-gradient">EmpowerFI</span>
        <p className="text-sm text-muted-foreground">© {new Date().getFullYear()} EmpowerFI. Todos os direitos reservados.</p>
        <div className="flex gap-6">
          <a href="#" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Termos</a>
          <a href="#" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Privacidade</a>
          <a href="mailto:contato@empowerfi.com.br" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Contato</a>
        </div>
      </div>
      <p className="text-xs text-muted-foreground text-center md:text-left max-w-3xl mx-auto md:mx-0 leading-relaxed">
        EmpowerFI é uma fintech de crédito em desenvolvimento. Para parcerias institucionais, fundos de investimento ou imprensa, entre em contato em{" "}
        <a href="mailto:contato@empowerfi.com.br" className="underline hover:text-foreground">contato@empowerfi.com.br</a>.
      </p>
    </div>
  </footer>
);

export default Footer;
