import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-5 px-4 py-24 text-center">
      <p className="text-8xl font-semibold text-muted-foreground/30">404</p>
      <h1 className="text-2xl font-semibold">Страница не найдена</h1>
      <p className="max-w-md text-muted-foreground">Возможно, товар снят с продажи или ссылка устарела. Загляните в каталог или воспользуйтесь поиском.</p>
      <div className="flex gap-2">
        <Link href="/" className={buttonVariants({ variant: "outline", size: "lg" })}>На главную</Link>
        <Link href="/catalog" className={buttonVariants({ size: "lg" })}>В каталог</Link>
      </div>
    </div>
  );
}
