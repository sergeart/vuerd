import StoreManagement from "@/store/StoreManagement";
import { Table, Column } from "@/store/table";
import { Relationship } from "@/store/relationship";
import { getData, autoName, uuid } from "@/ts/util";
import {
  formatNames,
  formatSize,
  formatSpace,
  primaryKey,
  primaryKeyColumns,
  unique,
  uniqueColumns,
  MaxLength,
  Name,
  KeyColumn
} from "../SQLHelper";

class MySQL {
  private fkNames: Name[] = [];

  public toDDL(store: StoreManagement): string {
    this.fkNames = [];
    const stringBuffer: string[] = [];
    const tables = store.tableStore.state.tables;
    const relationships = store.relationshipStore.state.relationships;
    const canvas = store.canvasStore.state;

    stringBuffer.push(`DROP SCHEMA IF EXISTS ${canvas.databaseName};`);
    stringBuffer.push("");
    stringBuffer.push(
      `CREATE SCHEMA ${canvas.databaseName} DEFAULT CHARACTER SET utf8;`
    );
    stringBuffer.push(`USE ${canvas.databaseName};`);
    stringBuffer.push("");

    tables.forEach(table => {
      this.formatTable(table, stringBuffer);
      stringBuffer.push("");
      // unique
      if (unique(table.columns)) {
        const uqColumns = uniqueColumns(table.columns);
        uqColumns.forEach(column => {
          stringBuffer.push(`ALTER TABLE ${table.name}`);
          stringBuffer.push(
            `  ADD CONSTRAINT UQ_${column.name} UNIQUE (${column.name});`
          );
          stringBuffer.push("");
        });
      }
    });
    relationships.forEach(relationship => {
      this.formatRelation(tables, relationship, stringBuffer);
      stringBuffer.push("");
    });

    return stringBuffer.join("\n");
  }

  private formatTable(table: Table, buffer: string[]) {
    buffer.push(`CREATE TABLE ${table.name}`);
    buffer.push(`(`);
    const pk = primaryKey(table.columns);
    const spaceSize = formatSize(table.columns);

    table.columns.forEach((column, i) => {
      if (pk) {
        this.formatColumn(column, true, spaceSize, buffer);
      } else {
        this.formatColumn(
          column,
          table.columns.length !== i + 1,
          spaceSize,
          buffer
        );
      }
    });
    // PK
    if (pk) {
      const pkColumns = primaryKeyColumns(table.columns);
      buffer.push(`  PRIMARY KEY (${formatNames(pkColumns)})`);
    }
    if (table.comment.trim() === "") {
      buffer.push(`);`);
    } else {
      buffer.push(`) COMMENT '${table.comment}';`);
    }
  }

  private formatColumn(
    column: Column,
    isComma: boolean,
    spaceSize: MaxLength,
    buffer: string[]
  ) {
    const stringBuffer: string[] = [];
    stringBuffer.push(
      `  ${column.name}` + formatSpace(spaceSize.name - column.name.length)
    );
    stringBuffer.push(
      `${column.dataType}` +
        formatSpace(spaceSize.dataType - column.dataType.length)
    );
    stringBuffer.push(`${column.option.notNull ? "NOT NULL" : "NULL    "}`);
    if (column.option.autoIncrement) {
      stringBuffer.push(`AUTO_INCREMENT`);
    } else {
      if (column.default.trim() !== "") {
        stringBuffer.push(`DEFAULT ${column.default}`);
      }
    }
    if (column.comment.trim() !== "") {
      stringBuffer.push(`COMMENT '${column.comment}'`);
    }
    buffer.push(stringBuffer.join(" ") + `${isComma ? "," : ""}`);
  }

  private formatRelation(
    tables: Table[],
    relationship: Relationship,
    buffer: string[]
  ) {
    const startTable = getData(tables, relationship.start.tableId);
    const endTable = getData(tables, relationship.end.tableId);

    if (startTable && endTable) {
      buffer.push(`ALTER TABLE ${endTable.name}`);

      // FK
      let fkName = `FK_${startTable.name}_TO_${endTable.name}`;
      fkName = autoName(this.fkNames, "", fkName);
      this.fkNames.push({
        id: uuid(),
        name: fkName
      });

      buffer.push(`  ADD CONSTRAINT ${fkName}`);

      // key
      const columns: KeyColumn = {
        start: [],
        end: []
      };
      relationship.end.columnIds.forEach(columnId => {
        const column = getData(endTable.columns, columnId);
        if (column) {
          columns.end.push(column);
        }
      });
      relationship.start.columnIds.forEach(columnId => {
        const column = getData(startTable.columns, columnId);
        if (column) {
          columns.start.push(column);
        }
      });

      buffer.push(`    FOREIGN KEY (${formatNames(columns.end)})`);
      buffer.push(
        `    REFERENCES ${startTable.name} (${formatNames(columns.start)});`
      );
    }
  }
}

export default new MySQL();
