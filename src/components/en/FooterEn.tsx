const FooterEn = () => (
  <footer className="border-t border-border py-10 px-4">
    <div className="container mx-auto flex flex-col gap-6">
      <div className="flex flex-col md:flex-row items-center justify-between gap-4">
        <span className="text-lg font-heading font-bold text-gradient">EmpowerFI</span>
        <p className="text-sm text-muted-foreground">© {new Date().getFullYear()} EmpowerFI. All rights reserved.</p>
        <div className="flex gap-6">
          <a href="#" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Terms</a>
          <a href="#" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Privacy</a>
          <a href="mailto:contato@empowerfi.com.br" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Contact</a>
        </div>
      </div>
      <p className="text-xs text-muted-foreground text-center md:text-left max-w-3xl mx-auto md:mx-0 leading-relaxed">
        EmpowerFI is a credit fintech in development. For institutional partnerships, investment funds or press, get in touch at{" "}
        <a href="mailto:contato@empowerfi.com.br" className="underline hover:text-foreground">contato@empowerfi.com.br</a>.
      </p>
    </div>
  </footer>
);

export default FooterEn;
