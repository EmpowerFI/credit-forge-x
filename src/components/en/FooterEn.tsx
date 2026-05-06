const FooterEn = () => (
  <footer className="border-t border-border py-10 px-4">
    <div className="container mx-auto flex flex-col gap-6">
      <div className="flex flex-col md:flex-row items-center justify-between gap-4">
        <span className="text-lg font-heading font-bold text-gradient">EmpowerFI</span>
        <p className="text-sm text-muted-foreground">© {new Date().getFullYear()} EmpowerFI. All rights reserved.</p>
        <div className="flex gap-6">
          <a href="#" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Terms</a>
          <a href="#" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Privacy</a>
          <a href="mailto:daniele@empowerfi.io" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Contact</a>
        </div>
      </div>
    </div>
  </footer>
);

export default FooterEn;
