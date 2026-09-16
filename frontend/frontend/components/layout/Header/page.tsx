"use client";

import { usePathname } from "next/navigation";

import styles from "./App.module.css";

interface HeaderProps {
    minimizado: boolean;
    setMinimizado: (valor: boolean) => void;
}

const pageInfo: Record<
    string,
    {
        title: string;
    }
> = {
    "/dashboard": {
        title: "Painel"    
    },

    "/alertas": {
        title: "Alertas"
    },

    "/usuarios": {
        title: "Usuários"
    },

    "/estagios": {
        title: "Estágios"
    },

    "/configuracoes": {
        title: "Configurações"

    },
};

export default function Header({
    minimizado,
    setMinimizado,
}: HeaderProps) {

    const pathname = usePathname();

    const currentPage =
        pageInfo[pathname] ?? {
            title: "Sinal",
            subtitle: "",
        };

    return (
        <header className={styles.header}>

            <button
                className={styles.menuButton}
                onClick={() =>
                    setMinimizado(!minimizado)
                }
                aria-label={
                    minimizado
                        ? "Expandir menu"
                        : "Minimizar menu"
                }
            >
                ☰
            </button>


            <div className={styles.pageInfo}>

                <h1>
                    {currentPage.title}
                </h1>

            </div>


            <div className={styles.actions}>

                {pathname === "/alertas" && (
                    <button className={styles.newButton}>
                        <span>＋</span>
                        Novo alerta
                    </button>
                )}

                <div className={styles.headerAvatar}>
                    RB
                </div>

            </div>

        </header>
    );
}