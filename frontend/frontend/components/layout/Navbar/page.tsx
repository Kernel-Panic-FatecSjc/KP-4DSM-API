"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import styles from "./App.module.css";

const menuItems = [
    {
        label: "Painel",
        href: "/dashboard",
        icon: "▣",
    },
    {
        label: "Alertas",
        href: "/alertas",
        icon: "⚠",
    },
    {
        label: "Usuários",
        href: "/usuarios",
        icon: "♙",
    },
    {
        label: "Estágios",
        href: "/estagios",
        icon: "▤",
    },
];

interface NavbarProps {
    minimizado: boolean;
}

export default function Navbar({
    minimizado,
}: NavbarProps) {
    const pathname = usePathname();

    return (
        <aside
            className={`${styles.container} ${
                minimizado ? styles.minimizada : ""
            }`}
        >


            <div className={styles.logoArea}>

                <div className={styles.logo}>
                    S
                </div>

                {!minimizado && (
                    <span className={styles.logoText}>
                        Sinal
                    </span>
                )}

            </div>

            <nav className={styles.menu}>

                <div className={styles.section}>

                    {!minimizado && (
                        <span className={styles.sectionTitle}>
                            OPERAÇÃO
                        </span>
                    )}

                    <div className={styles.items}>

                        {menuItems.map((item) => {

                            const active =
                                pathname === item.href;

                            return (
                                <Link
                                    key={item.label}
                                    href={item.href}
                                    className={`${styles.menuItem} ${
                                        active
                                            ? styles.active
                                            : ""
                                    }`}
                                    title={
                                        minimizado
                                            ? item.label
                                            : undefined
                                    }
                                >

                                    <span
                                        className={
                                            styles.menuIcon
                                        }
                                    >
                                        {item.icon}
                                    </span>

                                    {!minimizado && (
                                        <span>
                                            {item.label}
                                        </span>
                                    )}

                                </Link>
                            );
                        })}

                    </div>

                </div>

                <div className={styles.section}>

                    {!minimizado && (
                        <span className={styles.sectionTitle}>
                            SISTEMA
                        </span>
                    )}

                    <Link
                        href="/configuracoes"
                        className={`${styles.menuItem} ${
                            pathname === "/configuracoes"
                                ? styles.active
                                : ""
                        }`}
                        title={
                            minimizado
                                ? "Configurações"
                                : undefined
                        }
                    >

                        <span
                            className={styles.menuIcon}
                        >
                            ⚙
                        </span>

                        {!minimizado && (
                            <span>
                                Configurações
                            </span>
                        )}

                    </Link>

                </div>

            </nav>

            <div className={styles.userArea}>

                <div className={styles.avatar}>
                    RB
                </div>

                {!minimizado && (
                    <div className={styles.userInfo}>

                        <span className={styles.userName}>
                            Renata Braga
                        </span>

                        <span className={styles.userRole}>
                            operadora
                        </span>

                    </div>
                )}

            </div>

        </aside>
    );
}