"use client";

import React, { useMemo, useState } from "react";
import { PageHeading } from "@/components/PageHeading";
import { DataTable, Column } from "@/components/DataTable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type Sensor = {
    id: string;
    nome: string;
    tipo: string;
    unidade: string;
};

type Estacao = {
    nome: string;
    codigo: string;
    latitude: number;
    longitude: number;
    status: string;
    endereco: string;
    sensores: Sensor[];
};

type StatusOperacional = "ativo" | "inativo";

const tiposSensores = [
    "Temperatura",
    "Umidade",
    "Pressão",
    "Velocidade do vento",
    "Nível de água",
    "Radiação",
];

const unidadesMedida = ["°C", "%", "hPa", "m/s", "V", "A", "mm"];

const estacoesBase: Estacao[] = [
    {
        nome: "Sem resposta do turno",
        codigo: "123e4567-e89b-12d3-a456-426655440000",
        latitude: -23.5505,
        longitude: -46.6333,
        status: "Ativo",
        endereco: "Endereço não informado",
        sensores: [
            { id: "S-001", nome: "Sensor temperatura 01", tipo: "Temperatura", unidade: "°C" },
            { id: "S-002", nome: "Sensor temperatura 02", tipo: "Temperatura", unidade: "°C" },
            { id: "S-003", nome: "Sensor umidade 01", tipo: "Umidade", unidade: "%" },
            { id: "S-004", nome: "Sensor umidade 02", tipo: "Umidade", unidade: "%" },
            { id: "S-005", nome: "Sensor velocidade 01", tipo: "Velocidade do vento", unidade: "m/s" },
            { id: "S-006", nome: "Sensor velocidade 02", tipo: "Velocidade do vento", unidade: "m/s" },
            { id: "S-007", nome: "Sensor pressão 01", tipo: "Pressão", unidade: "hPa" },
            { id: "S-008", nome: "Sensor pressão 02", tipo: "Pressão", unidade: "hPa" },
            { id: "S-009", nome: "Sensor pressão 03", tipo: "Pressão", unidade: "hPa" },
            { id: "S-010", nome: "Sensor radiação 01", tipo: "Radiação", unidade: "V" },
            { id: "S-011", nome: "Sensor radiação 02", tipo: "Radiação", unidade: "V" },
            { id: "S-012", nome: "Sensor nível 01", tipo: "Nível de água", unidade: "mm" },
        ],
    },
    {
        nome: "Sinal fora da faixa",
        codigo: "550e8400-e29b-41d4-a716-446655440000",
        latitude: -23.5487,
        longitude: -46.6321,
        status: "Ativo",
        endereco: "Endereço não informado",
        sensores: [
            { id: "S-013", nome: "Sensor temperatura 03", tipo: "Temperatura", unidade: "°C" },
            { id: "S-014", nome: "Sensor temperatura 04", tipo: "Temperatura", unidade: "°C" },
            { id: "S-015", nome: "Sensor umidade 03", tipo: "Umidade", unidade: "%" },
            { id: "S-016", nome: "Sensor umidade 04", tipo: "Umidade", unidade: "%" },
            { id: "S-017", nome: "Sensor pressão 04", tipo: "Pressão", unidade: "hPa" },
            { id: "S-018", nome: "Sensor radiação 03", tipo: "Radiação", unidade: "V" },
            { id: "S-019", nome: "Sensor nível 02", tipo: "Nível de água", unidade: "mm" },
            { id: "S-020", nome: "Sensor nível 03", tipo: "Nível de água", unidade: "mm" },
        ],
    },
    {
        nome: "Estoque de bateria baixo",
        codigo: "f47ac10b-58cc-4372-a567-0e02b2c3d479",
        latitude: -23.5519,
        longitude: -46.6301,
        status: "Ativo",
        endereco: "Endereço não informado",
        sensores: [
            { id: "S-021", nome: "Sensor umidade 05", tipo: "Umidade", unidade: "%" },
            { id: "S-022", nome: "Sensor umidade 06", tipo: "Umidade", unidade: "%" },
            { id: "S-023", nome: "Sensor pressão 05", tipo: "Pressão", unidade: "hPa" },
            { id: "S-024", nome: "Sensor nível 04", tipo: "Nível de água", unidade: "mm" },
            { id: "S-025", nome: "Sensor temperatura 05", tipo: "Temperatura", unidade: "°C" },
        ],
    },
    {
        nome: "Discrepância de registro",
        codigo: "9c858901-8a57-4791-81fe-4c455b099bc9",
        latitude: -23.5534,
        longitude: -46.6342,
        status: "Não Ativo",
        endereco: "Endereço não informado",
        sensores: [
            { id: "S-026", nome: "Sensor temperatura 06", tipo: "Temperatura", unidade: "°C" },
            { id: "S-027", nome: "Sensor temperatura 07", tipo: "Temperatura", unidade: "°C" },
            { id: "S-028", nome: "Sensor umidade 07", tipo: "Umidade", unidade: "%" },
            { id: "S-029", nome: "Sensor umidade 08", tipo: "Umidade", unidade: "%" },
            { id: "S-030", nome: "Sensor umidade 09", tipo: "Umidade", unidade: "%" },
            { id: "S-031", nome: "Sensor pressão 06", tipo: "Pressão", unidade: "hPa" },
            { id: "S-032", nome: "Sensor pressão 07", tipo: "Pressão", unidade: "hPa" },
            { id: "S-033", nome: "Sensor pressão 08", tipo: "Pressão", unidade: "hPa" },
            { id: "S-034", nome: "Sensor nível 05", tipo: "Nível de água", unidade: "mm" },
            { id: "S-035", nome: "Sensor nível 06", tipo: "Nível de água", unidade: "mm" },
        ],
    },
];

const ITENS_POR_PAGINA = 5;

export default function Estacoes() {
    const [estacoes, setEstacoes] = useState<Estacao[]>(estacoesBase);
    const [pesquisa, setPesquisa] = useState("");
    const [paginaAtual, setPaginaAtual] = useState(1);
    const [modalAberto, setModalAberto] = useState(false);
    const [modoEdicao, setModoEdicao] = useState<"cadastro" | "edicao">("cadastro");
    const [estacaoSelecionada, setEstacaoSelecionada] = useState<Estacao | null>(null);
    const [nome, setNome] = useState("");
    const [uuid, setUuid] = useState("");
    const [latitude, setLatitude] = useState("");
    const [longitude, setLongitude] = useState("");
    const [endereco, setEndereco] = useState("");
    const [statusOperacional, setStatusOperacional] = useState<StatusOperacional>("ativo");
    const [menuAbertoCodigo, setMenuAbertoCodigo] = useState<string | null>(null);
    const [confirmacaoExclusao, setConfirmacaoExclusao] = useState<string | null>(null);
    const [modalAssociacaoAberto, setModalAssociacaoAberto] = useState(false);
    const [estacaoAssociada, setEstacaoAssociada] = useState<Estacao | null>(null);
    const [tipoSensor, setTipoSensor] = useState("Temperatura");
    const [unidadeMedidaSelecionada, setUnidadeMedidaSelecionada] = useState("°C");
    const [nomeSensor, setNomeSensor] = useState("");
    const [listaSensores, setListaSensores] = useState<Sensor[]>([]);

    const estacoesFiltradas = useMemo(() => {
        const termo = pesquisa.trim().toLowerCase();

        if (!termo) {
            return estacoes;
        }

        return estacoes.filter((estacao) => {
            const nomeEstacao = estacao.nome.toLowerCase();
            const codigo = estacao.codigo.toLowerCase();

            return nomeEstacao.includes(termo) || codigo.includes(termo);
        });
    }, [pesquisa, estacoes]);

    const totalPaginas = Math.max(1, Math.ceil(estacoesFiltradas.length / ITENS_POR_PAGINA));

    const paginaSegura = Math.min(paginaAtual, totalPaginas);
    const indiceInicial = (paginaSegura - 1) * ITENS_POR_PAGINA;
    const estacoesPagina = estacoesFiltradas.slice(
        indiceInicial,
        indiceInicial + ITENS_POR_PAGINA
    );

    const indiceFinal = Math.min(
        indiceInicial + estacoesPagina.length,
        estacoesFiltradas.length
    );

    const limparFormulario = () => {
        setNome("");
        setUuid("");
        setLatitude("");
        setLongitude("");
        setEndereco("");
        setStatusOperacional("ativo");
    };

    const resetarAssociacao = () => {
        setTipoSensor("Temperatura");
        setUnidadeMedidaSelecionada("°C");
        setNomeSensor("");
        setListaSensores([]);
    };

    const handlePesquisa = (event: React.ChangeEvent<HTMLInputElement>) => {
        setPesquisa(event.target.value);
        setPaginaAtual(1);
    };

    const proximaPagina = () => {
        setPaginaAtual((atual) => Math.min(atual + 1, totalPaginas));
    };

    const paginaAnterior = () => {
        setPaginaAtual((atual) => Math.max(atual - 1, 1));
    };

    const abrirModal = () => {
        setModoEdicao("cadastro");
        setEstacaoSelecionada(null);
        limparFormulario();
        setModalAberto(true);
        setMenuAbertoCodigo(null);
    };

    const abrirModalEdicao = (estacao: Estacao) => {
        setModoEdicao("edicao");
        setEstacaoSelecionada(estacao);
        setNome(estacao.nome);
        setUuid(estacao.codigo);
        setLatitude(String(estacao.latitude));
        setLongitude(String(estacao.longitude));
        setEndereco(estacao.endereco);
        setStatusOperacional(estacao.status === "Ativo" ? "ativo" : "inativo");
        setModalAberto(true);
        setMenuAbertoCodigo(null);
    };

    const fecharModal = () => {
        setModalAberto(false);
        setModoEdicao("cadastro");
        setEstacaoSelecionada(null);
        limparFormulario();
    };

    const abrirModalAssociacao = (estacao: Estacao) => {
        setEstacaoAssociada(estacao);
        setTipoSensor(estacao.sensores[0]?.tipo ?? "Temperatura");
        setUnidadeMedidaSelecionada(estacao.sensores[0]?.unidade ?? "°C");
        setListaSensores(estacao.sensores);
        setNomeSensor("");
        setModalAssociacaoAberto(true);
        setMenuAbertoCodigo(null);
    };

    const fecharModalAssociacao = () => {
        setModalAssociacaoAberto(false);
        setEstacaoAssociada(null);
        resetarAssociacao();
    };

    const adicionarSensorLista = () => {
        const sensorLimpo = nomeSensor.trim();

        if (!sensorLimpo) {
            return;
        }

        setListaSensores((listaAtuais) => {
            if (listaAtuais.some((sensor) => sensor.nome === sensorLimpo)) {
                return listaAtuais;
            }

            return [
                ...listaAtuais,
                {
                    id: `S-${Date.now()}`,
                    nome: sensorLimpo,
                    tipo: tipoSensor,
                    unidade: unidadeMedidaSelecionada,
                },
            ];
        });
        setNomeSensor("");
    };

    const removerSensorLista = (id: string) => {
        setListaSensores((listaAtuais) => listaAtuais.filter((sensor) => sensor.id !== id));
    };

    const salvarAssociacao = () => {
        if (!estacaoAssociada || listaSensores.length === 0) {
            return;
        }

        setEstacoes((lista) =>
            lista.map((estacao) =>
                estacao.codigo === estacaoAssociada.codigo
                    ? { ...estacao, sensores: listaSensores }
                    : estacao
            )
        );

        fecharModalAssociacao();
    };

    const cadastrarEstacao = () => {
        const nomeDaEstacao = nome.trim();

        if (!nomeDaEstacao) {
            return;
        }

        const codigo = uuid.trim() || `EST-${Math.floor(1000 + Math.random() * 9000)}`;
        const statusFinal = statusOperacional === "ativo" ? "Ativo" : "Não Ativo";
        const novoEndereco = endereco.trim() || "Endereço não informado";

        if (modoEdicao === "edicao" && estacaoSelecionada) {
            setEstacoes((lista) =>
                lista.map((estacao) =>
                    estacao.codigo === estacaoSelecionada.codigo
                        ? {
                              ...estacao,
                              nome: nomeDaEstacao,
                              codigo,
                              latitude: Number(latitude) || estacao.latitude,
                              longitude: Number(longitude) || estacao.longitude,
                              status: statusFinal,
                              endereco: novoEndereco,
                          }
                        : estacao
                )
            );
            fecharModal();
            return;
        }

        const novaEstacao: Estacao = {
            nome: nomeDaEstacao,
            codigo,
            latitude: Number(latitude) || -23.5505,
            longitude: Number(longitude) || -46.6333,
            status: statusFinal,
            endereco: novoEndereco,
            sensores: [],
        };

        setEstacoes((lista) => [novaEstacao, ...lista]);
        setPesquisa("");
        setPaginaAtual(1);
        fecharModal();
    };

    const confirmarExclusao = (codigo: string) => {
        setConfirmacaoExclusao(codigo);
        setMenuAbertoCodigo(null);
    };

    const excluirEstacao = () => {
        if (!confirmacaoExclusao) {
            return;
        }

        setEstacoes((lista) =>
            lista.filter((estacao) => estacao.codigo !== confirmacaoExclusao)
        );
        setConfirmacaoExclusao(null);
    };

    const renderizarContagemSensores = (estacao: Estacao) => {
        const total = estacao.sensores.length;

        if (total === 0) {
            return "0 sensores";
        }

        return `${total} ${total === 1 ? "sensor" : "sensores"}`;
    };

    const tableColumns: Column<Estacao>[] = [
        {
            header: "Estação",
            key: "nome",
            render: (_, estacao) => (
                <div className="flex flex-col">
                    <span className="font-medium">{estacao.nome}</span>
                    <span className="font-mono text-[10px] text-muted-foreground">{estacao.codigo}</span>
                </div>
            ),
        },
        {
            header: "Latitude/Longitude",
            key: "latitude",
            render: (_, estacao) => `${estacao.latitude}, ${estacao.longitude}`,
        },
        {
            header: "Status",
            key: "status",
            render: (_, estacao) => (
                <span className={cn(
                    "inline-flex items-center gap-1.5 rounded px-2 py-1 text-xs font-medium",
                    estacao.status === "Ativo"
                        ? "bg-lime/15 text-lime"
                        : "bg-destructive/15 text-destructive"
                )}>
                    <span className={cn(
                        "size-1.5 rounded-full",
                        estacao.status === "Ativo" ? "bg-lime" : "bg-destructive"
                    )} />
                    {estacao.status}
                </span>
            ),
        },
        {
            header: "Sensores",
            key: "sensores",
            render: (_, estacao) => renderizarContagemSensores(estacao),
        },
        {
            header: "Ações",
            key: "codigo",
            render: (_, estacao) => (
                <div className="flex items-center justify-end gap-2">
                    <Button
                        variant="ghost"
                        size="sm"
                        type="button"
                        aria-label={`Associar sensores à ${estacao.nome}`}
                        onClick={() => abrirModalAssociacao(estacao)}
                    >
                        +
                    </Button>

                    <div className="relative">
                        <Button
                            variant="ghost"
                            size="sm"
                            type="button"
                            aria-label={`Mais opções para ${estacao.nome}`}
                            onClick={() =>
                                setMenuAbertoCodigo(
                                    menuAbertoCodigo === estacao.codigo ? null : estacao.codigo
                                )
                            }
                        >
                            …
                        </Button>

                        {menuAbertoCodigo === estacao.codigo && (
                            <div className="absolute right-0 top-full z-10 mt-1 w-40 rounded-lg border border-border bg-card shadow-lg" role="menu">
                                <button
                                    type="button"
                                    className="block w-full px-4 py-2 text-left text-sm hover:bg-muted"
                                    onClick={() => abrirModalEdicao(estacao)}
                                >
                                    Editar
                                </button>
                                <button
                                    type="button"
                                    className="block w-full px-4 py-2 text-left text-sm text-destructive hover:bg-destructive/10"
                                    onClick={() => confirmarExclusao(estacao.codigo)}
                                >
                                    Deletar
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            ),
        },
    ];

    return (
        <div className="space-y-5">
            <PageHeading
                title="Estações"
                description="Acompanhe e gerencie as estações do sistema."
                action={
                    <Button type="button" onClick={abrirModal}>
                        + Nova Estação
                    </Button>
                }
            />

            <Input
                placeholder="Buscar por estação ou código"
                value={pesquisa}
                onChange={handlePesquisa}
                className="rise delay-0"
            />

            <DataTable
                columns={tableColumns}
                data={estacoesPagina}
                currentPage={paginaSegura}
                totalPages={totalPaginas}
                onPageChange={(page) => setPaginaAtual(page)}
                rowKey="codigo"
            />

            {modalAberto && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={fecharModal}>
                    <div className="w-full max-w-md rounded-lg border border-border bg-card p-6 shadow-lg" onClick={(event) => event.stopPropagation()}>
                        <button
                            type="button"
                            className="absolute right-4 top-4 text-2xl text-muted-foreground hover:text-foreground"
                            aria-label="Fechar modal"
                            onClick={fecharModal}
                        >
                            ×
                        </button>

                        <h2 className="mb-6 text-lg font-semibold">
                            {modoEdicao === "edicao" ? "Editar estação" : "Cadastrar estação"}
                        </h2>

                        <div className="space-y-4">
                            <div className="flex flex-col gap-1">
                                <label htmlFor="nome" className="font-mono text-[10px] uppercase text-muted-foreground">
                                    Nome
                                </label>
                                <Input
                                    id="nome"
                                    type="text"
                                    value={nome}
                                    onChange={(event) => setNome(event.target.value)}
                                />
                            </div>

                            <div className="flex flex-col gap-1">
                                <label htmlFor="uuid" className="font-mono text-[10px] uppercase text-muted-foreground">
                                    UUID/MAC
                                </label>
                                <Input
                                    id="uuid"
                                    type="text"
                                    value={uuid}
                                    onChange={(event) => setUuid(event.target.value)}
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div className="flex flex-col gap-1">
                                    <label htmlFor="latitude" className="font-mono text-[10px] uppercase text-muted-foreground">
                                        Latitude
                                    </label>
                                    <Input
                                        id="latitude"
                                        type="number"
                                        step="any"
                                        value={latitude}
                                        onChange={(event) => setLatitude(event.target.value)}
                                        placeholder="Ex: -23.5505"
                                    />
                                </div>

                                <div className="flex flex-col gap-1">
                                    <label htmlFor="longitude" className="font-mono text-[10px] uppercase text-muted-foreground">
                                        Longitude
                                    </label>
                                    <Input
                                        id="longitude"
                                        type="number"
                                        step="any"
                                        value={longitude}
                                        onChange={(event) => setLongitude(event.target.value)}
                                        placeholder="Ex: -46.6333"
                                    />
                                </div>
                            </div>

                            <div className="flex flex-col gap-1">
                                <label htmlFor="endereco" className="font-mono text-[10px] uppercase text-muted-foreground">
                                    Endereço/Região
                                </label>
                                <Input
                                    id="endereco"
                                    type="text"
                                    value={endereco}
                                    onChange={(event) => setEndereco(event.target.value)}
                                />
                            </div>

                            <div className="flex flex-col gap-1">
                                <label htmlFor="status" className="font-mono text-[10px] uppercase text-muted-foreground">
                                    Status Operacional
                                </label>
                                <select
                                    id="status"
                                    value={statusOperacional}
                                    onChange={(event) => setStatusOperacional(event.target.value as StatusOperacional)}
                                    className="rounded border border-border bg-card px-3 py-2 text-sm"
                                >
                                    <option value="ativo">Ativo</option>
                                    <option value="inativo">Não Ativo</option>
                                </select>
                            </div>
                        </div>

                        <div className="mt-6 flex justify-end gap-3">
                            <Button variant="outline" type="button" onClick={fecharModal}>
                                Cancelar
                            </Button>
                            <Button type="button" onClick={cadastrarEstacao}>
                                {modoEdicao === "edicao" ? "Salvar" : "Cadastrar"}
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {modalAssociacaoAberto && estacaoAssociada && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={fecharModalAssociacao}>
                    <div className="w-full max-w-lg rounded-lg border border-border bg-card p-6 shadow-lg" onClick={(event) => event.stopPropagation()}>
                        <button
                            type="button"
                            className="absolute right-4 top-4 text-2xl text-muted-foreground hover:text-foreground"
                            aria-label="Fechar modal de associação"
                            onClick={fecharModalAssociacao}
                        >
                            ×
                        </button>

                        <h2 className="text-lg font-semibold">Sensores da estação</h2>
                        <p className="mt-1 text-sm text-muted-foreground">{estacaoAssociada.nome}</p>

                        <div className="mt-6 space-y-4">
                            <div className="grid grid-cols-2 gap-3">
                                <div className="flex flex-col gap-1">
                                    <label htmlFor="tipoSensor" className="font-mono text-[10px] uppercase text-muted-foreground">
                                        Tipo
                                    </label>
                                    <select
                                        id="tipoSensor"
                                        value={tipoSensor}
                                        onChange={(event) => setTipoSensor(event.target.value)}
                                        className="rounded border border-border bg-card px-3 py-2 text-sm"
                                    >
                                        {tiposSensores.map((tipo) => (
                                            <option key={tipo} value={tipo}>
                                                {tipo}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div className="flex flex-col gap-1">
                                    <label htmlFor="unidadeMedida" className="font-mono text-[10px] uppercase text-muted-foreground">
                                        Unidade de medida
                                    </label>
                                    <select
                                        id="unidadeMedida"
                                        value={unidadeMedidaSelecionada}
                                        onChange={(event) => setUnidadeMedidaSelecionada(event.target.value)}
                                        className="rounded border border-border bg-card px-3 py-2 text-sm"
                                    >
                                        {unidadesMedida.map((unidade) => (
                                            <option key={unidade} value={unidade}>
                                                {unidade}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div className="flex flex-col gap-1">
                                <label htmlFor="nomeSensor" className="font-mono text-[10px] uppercase text-muted-foreground">
                                    Nome do sensor
                                </label>
                                <div className="flex gap-2">
                                    <Input
                                        id="nomeSensor"
                                        type="text"
                                        value={nomeSensor}
                                        onChange={(event) => setNomeSensor(event.target.value)}
                                        placeholder="Digite o nome do sensor"
                                    />
                                    <Button
                                        type="button"
                                        variant="outline"
                                        onClick={adicionarSensorLista}
                                    >
                                        Adicionar
                                    </Button>
                                </div>
                            </div>

                            {listaSensores.length === 0 ? (
                                <div className="rounded border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
                                    Nenhum sensor adicionado
                                </div>
                            ) : (
                                <div className="space-y-2 rounded border border-border bg-muted/30 p-4">
                                    {listaSensores.map((sensor) => (
                                        <div key={sensor.id} className="flex items-center justify-between gap-2 rounded border border-border bg-card p-3 text-sm">
                                            <div className="flex-1 min-w-0">
                                                <div className="flex gap-2 text-xs text-muted-foreground">
                                                    <span className="font-mono">{sensor.id}</span>
                                                    <span>{sensor.tipo}</span>
                                                    <span>{sensor.unidade}</span>
                                                </div>
                                                <div className="mt-1 font-medium">{sensor.nome}</div>
                                            </div>
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="sm"
                                                className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                                aria-label={`Remover ${sensor.nome}`}
                                                onClick={() => removerSensorLista(sensor.id)}
                                            >
                                                Remover
                                            </Button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div className="mt-6 flex justify-end gap-3">
                            <Button variant="outline" type="button" onClick={fecharModalAssociacao}>
                                Cancelar
                            </Button>
                            <Button type="button" onClick={salvarAssociacao}>
                                Salvar sensores
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {confirmacaoExclusao && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setConfirmacaoExclusao(null)}>
                    <div className="w-full max-w-md rounded-lg border border-border bg-card p-6 shadow-lg" onClick={(event) => event.stopPropagation()}>
                        <h2 className="text-lg font-semibold">Confirmar exclusão</h2>
                        <p className="mt-3 text-sm text-muted-foreground">
                            Tem certeza que deseja deletar esta estação? Essa ação não pode ser desfeita.
                        </p>

                        <div className="mt-6 flex justify-end gap-3">
                            <Button variant="outline" type="button" onClick={() => setConfirmacaoExclusao(null)}>
                                Cancelar
                            </Button>
                            <Button
                                type="button"
                                onClick={excluirEstacao}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                                Deletar
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}