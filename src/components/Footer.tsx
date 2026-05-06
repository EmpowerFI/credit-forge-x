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
    </div>
  </footer>
);

export default Footer;
