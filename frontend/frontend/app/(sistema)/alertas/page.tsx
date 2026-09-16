import React from "react";
import styles from "./App.module.css";

export default function Alertas() {
    return (
        <div>
            <h1 className={styles.title}>Alertas</h1>

            <span className={styles.subtitle}>
                Acompanhe e resolva ocorrências operacionais.
            </span>

            <br />
            <br />

            <input
                placeholder="Buscar por alerta"
                className={styles.searchBar}
            />
            <div className={styles.tableContainer}>
                <div className={styles.tableHeader}>
                    <span>Alertas</span>
                    <button className={styles.exportButton}>
                        Exportar
                    </button>
                </div>
                <table className={styles.table}>
                    <thead>
                        <tr>    
                            <th>ALERTA</th>
                            <th>ESTÁGIO</th>
                            <th>SEVERIDADE</th>
                            <th>TEMPO</th>
                            <th>AÇÕES</th>
                        </tr>
                    </thead>
                    <tbody></tbody>
                </table>
            </div>
        </div>
    );
}